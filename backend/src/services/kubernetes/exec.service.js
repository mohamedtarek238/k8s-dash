const stream = require('stream');
const WebSocket = require('ws');
const k8s = require('@kubernetes/client-node');
const { getResponseBody } = require('../../utils/k8sHelpers');

/**
 * Validates a Pod and target container to ensure it exists and is currently Running.
 */
async function validatePodAndContainer(clients, namespace, podName, containerName) {
  const { coreV1Api } = clients;

  let pod;
  try {
    const response = await coreV1Api.readNamespacedPod({ name: podName, namespace });
    pod = getResponseBody(response);
  } catch (err) {
    if (err.statusCode === 404 || err.code === 404) {
      throw new Error(`Pod "${podName}" was not found in namespace "${namespace}".`);
    }
    if (err.statusCode === 403 || err.code === 403) {
      throw new Error(`Permission denied: Cannot inspect pod "${podName}" in namespace "${namespace}".`);
    }
    throw err;
  }

  const phase = pod.status?.phase || 'Unknown';
  if (phase !== 'Running') {
    throw new Error(`Cannot open terminal: Pod is in "${phase}" phase (must be "Running").`);
  }

  const allContainers = [
    ...(pod.spec?.containers || []),
    ...(pod.spec?.initContainers || []),
  ];

  const allStatuses = [
    ...(pod.status?.containerStatuses || []),
    ...(pod.status?.initContainerStatuses || []),
  ];

  let targetContainer = containerName;
  if (!targetContainer) {
    // Pick the first running regular container
    const runningStatus = (pod.status?.containerStatuses || []).find((c) => c.state?.running);
    if (runningStatus) {
      targetContainer = runningStatus.name;
    } else if (pod.spec?.containers?.[0]) {
      targetContainer = pod.spec.containers[0].name;
    } else {
      throw new Error(`Pod "${podName}" has no containers defined.`);
    }
  }

  const specExists = allContainers.some((c) => c.name === targetContainer);
  if (!specExists) {
    const available = allContainers.map((c) => c.name).join(', ');
    throw new Error(`Container "${targetContainer}" does not exist in pod "${podName}". Available: ${available}`);
  }

  const status = allStatuses.find((c) => c.name === targetContainer);
  if (!status?.state?.running) {
    if (status?.state?.waiting) {
      const reason = status.state.waiting.reason || 'Waiting';
      const msg = status.state.waiting.message ? `: ${status.state.waiting.message}` : '';
      throw new Error(`Cannot open terminal: Container "${targetContainer}" is not running (${reason}${msg}).`);
    }
    if (status?.state?.terminated) {
      const reason = status.state.terminated.reason || 'Terminated';
      const code = status.state.terminated.exitCode ?? 'unknown';
      throw new Error(`Cannot open terminal: Container "${targetContainer}" is terminated (exitCode: ${code}, reason: ${reason}).`);
    }
    throw new Error(`Cannot open terminal: Container "${targetContainer}" is not in running state.`);
  }

  return { pod, container: targetContainer };
}

/**
 * Attaches a resizable stdout stream and stdin stream to k8s.Exec,
 * bridging messages between the browser WebSocket and the Kubernetes Exec stream.
 */
function startExecConnection({
  clients,
  namespace,
  podName,
  container,
  command,
  initialCols = 80,
  initialRows = 24,
  onOutput,
  onExit,
}) {
  const exec = new k8s.Exec(clients.kubeConfig);

  const stdinStream = new stream.PassThrough();

  // Custom Writable stream with rows & columns properties so isResizable(stdout) returns true
  const stdoutStream = new stream.Writable({
    write(chunk, encoding, callback) {
      onOutput(chunk);
      callback();
    },
  });

  stdoutStream.columns = initialCols;
  stdoutStream.rows = initialRows;

  // Stderr is directed to the same output handler
  const stderrStream = new stream.Writable({
    write(chunk, encoding, callback) {
      onOutput(chunk);
      callback();
    },
  });

  const connectionPromise = exec.exec(
    namespace,
    podName,
    container,
    command,
    stdoutStream,
    stderrStream,
    stdinStream,
    true, // tty
    (status) => {
      onExit(status);
    }
  );

  return {
    connectionPromise,
    stdinStream,
    stdoutStream,
    resize(cols, rows) {
      stdoutStream.columns = cols;
      stdoutStream.rows = rows;
      stdoutStream.emit('resize');
    },
  };
}

/**
 * Manages the full lifecycle of a Pod Web Terminal session over WebSocket.
 */
async function handlePodTerminalSession({
  browserWs,
  clients,
  clusterId,
  namespace,
  podName,
  containerName,
  shellPreference = 'auto',
  initialCols = 80,
  initialRows = 24,
}) {
  const startTime = Date.now();
  let validatedContainer = containerName;
  let activeK8sConn = null;
  let activeStdin = null;
  let activeResize = null;
  let isClosed = false;

  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;

    try {
      if (activeStdin) {
        activeStdin.end();
      }
    } catch (_) {}

    try {
      if (activeK8sConn && typeof activeK8sConn.close === 'function') {
        activeK8sConn.close();
      }
    } catch (_) {}

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Terminal] Disconnected: cluster="${clusterId}" namespace="${namespace}" pod="${podName}" container="${validatedContainer || 'unknown'}" (duration: ${duration}s)`
    );
  };

  browserWs.on('close', cleanup);
  browserWs.on('error', (err) => {
    console.error(`[Terminal] Client socket error: ${err.message}`);
    cleanup();
  });

  // 1. Validate Pod and Container existence and running state
  try {
    const validated = await validatePodAndContainer(clients, namespace, podName, containerName);
    validatedContainer = validated.container;
  } catch (validationErr) {
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(
        JSON.stringify({
          type: 'error',
          message: validationErr.message,
        })
      );
      browserWs.close(1008, 'Validation failed');
    }
    return;
  }

  // Determine shell candidate list
  let shellCandidates;
  if (shellPreference === '/bin/sh') {
    shellCandidates = ['/bin/sh'];
  } else if (shellPreference === '/bin/bash') {
    shellCandidates = ['/bin/bash'];
  } else {
    // auto: prefer /bin/bash, fall back to /bin/sh
    shellCandidates = ['/bin/bash', '/bin/sh'];
  }

  let connectedSuccessfully = false;
  let activeShell = null;
  const earlyInputQueue = [];
  let pendingResize = null;

  const writeToStdin = (chunk) => {
    if (activeStdin) {
      activeStdin.write(chunk);
    } else {
      earlyInputQueue.push(chunk);
    }
  };

  const triggerResize = (cols, rows) => {
    if (activeResize) {
      activeResize(cols, rows);
    } else {
      pendingResize = { cols, rows };
    }
  };

  // Wire incoming browser messages once
  browserWs.on('message', (data, isBinary) => {
    if (isClosed) return;

    if (!isBinary) {
      const text = data.toString('utf8');
      // Check for JSON control messages (e.g. resize, ping)
      if (text.startsWith('{') && text.endsWith('}')) {
        try {
          const msg = JSON.parse(text);
          if (msg.type === 'resize' && msg.cols && msg.rows) {
            const cols = Number(msg.cols);
            const rows = Number(msg.rows);
            triggerResize(cols, rows);
            return;
          }
          if (msg.type === 'stdin' && msg.data !== undefined) {
            writeToStdin(msg.data);
            return;
          }
          if (msg.type === 'ping') {
            if (browserWs.readyState === WebSocket.OPEN) {
              browserWs.send(JSON.stringify({ type: 'pong' }));
            }
            return;
          }
        } catch (_) {
          // Not a control message, treat as stdin
        }
      }
      writeToStdin(text);
    } else {
      writeToStdin(data);
    }
  });

  for (let i = 0; i < shellCandidates.length; i++) {
    const currentShell = shellCandidates[i];
    if (isClosed) return;

    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(
        JSON.stringify({
          type: 'status',
          status: 'connecting',
          message: `Connecting using ${currentShell}...`,
          pod: podName,
          container: validatedContainer,
          shell: currentShell,
        })
      );
    }

    let immediateFailure = false;
    let failureStatus = null;
    let shellSpawned = false;

    const session = startExecConnection({
      clients,
      namespace,
      podName,
      container: validatedContainer,
      command: [currentShell],
      initialCols,
      initialRows,
      onOutput(chunk) {
        if (!shellSpawned) {
          shellSpawned = true;
          connectedSuccessfully = true;
          activeShell = currentShell;

          console.log(
            `[Terminal] Connected: cluster="${clusterId}" namespace="${namespace}" pod="${podName}" container="${validatedContainer}" shell="${activeShell}"`
          );

          if (browserWs.readyState === WebSocket.OPEN) {
            browserWs.send(
              JSON.stringify({
                type: 'status',
                status: 'connected',
                message: `Connected to ${validatedContainer} (${activeShell})`,
                pod: podName,
                container: validatedContainer,
                shell: activeShell,
              })
            );
          }
        }

        if (browserWs.readyState === WebSocket.OPEN) {
          browserWs.send(chunk);
        }
      },
      onExit(status) {
        if (!shellSpawned) {
          immediateFailure = true;
          failureStatus = status;
        } else {
          if (browserWs.readyState === WebSocket.OPEN) {
            browserWs.send(
              JSON.stringify({
                type: 'exit',
                code: status?.details?.causes?.[0]?.message || status?.code || 0,
                message: status?.message || 'Process exited',
              })
            );
            browserWs.close(1000, 'Process exited');
          }
          cleanup();
        }
      },
    });

    activeStdin = session.stdinStream;
    activeResize = session.resize;

    // Flush any pending resize or inputs queued before session initialization
    if (pendingResize) {
      activeResize(pendingResize.cols, pendingResize.rows);
      pendingResize = null;
    }
    while (earlyInputQueue.length > 0) {
      const pendingInput = earlyInputQueue.shift();
      activeStdin.write(pendingInput);
    }

    try {
      const conn = await session.connectionPromise;
      activeK8sConn = conn;

      // Allow a brief window to confirm process didn't immediately fail (e.g. bash not found)
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (immediateFailure && !shellSpawned) {
        // Current shell failed immediately, try next candidate if available
        try {
          conn.close();
        } catch (_) {}
        continue;
      }

      if (!shellSpawned) {
        shellSpawned = true;
        connectedSuccessfully = true;
        activeShell = currentShell;

        console.log(
          `[Terminal] Connected: cluster="${clusterId}" namespace="${namespace}" pod="${podName}" container="${validatedContainer}" shell="${activeShell}"`
        );

        if (browserWs.readyState === WebSocket.OPEN) {
          browserWs.send(
            JSON.stringify({
              type: 'status',
              status: 'connected',
              message: `Connected to ${validatedContainer} (${activeShell})`,
              pod: podName,
              container: validatedContainer,
              shell: activeShell,
            })
          );
        }
      }

      break;
    } catch (connErr) {
      const errMsg = connErr.message || String(connErr);
      if (connErr.statusCode === 403 || errMsg.includes('403') || errMsg.includes('Forbidden')) {
        if (browserWs.readyState === WebSocket.OPEN) {
          browserWs.send(
            JSON.stringify({
              type: 'error',
              message:
                'Permission denied: the current Kubernetes identity cannot execute commands in this Pod (requires pods/exec create permission).',
            })
          );
          browserWs.close(1008, 'Permission denied');
        }
        return;
      }

      // If more candidates exist, continue
      if (i < shellCandidates.length - 1) {
        continue;
      }
    }
  }

  if (!connectedSuccessfully) {
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(
        JSON.stringify({
          type: 'error',
          message:
            shellPreference === 'auto'
              ? 'No compatible shell (/bin/bash or /bin/sh) was found in this container.'
              : `Selected shell "${shellPreference}" is not available in this container.`,
        })
      );
      browserWs.close(1011, 'No compatible shell');
    }
    cleanup();
  }
}

module.exports = {
  validatePodAndContainer,
  startExecConnection,
  handlePodTerminalSession,
};
