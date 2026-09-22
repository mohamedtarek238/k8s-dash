const { WebSocketServer } = require('ws');
const { getClusterClients, getDefaultClusterId, listClusters } = require('../config/kubernetes');
const { handlePodTerminalSession } = require('../services/kubernetes/exec.service');

function setupTerminalWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    let url;
    try {
      url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    } catch (_) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Match /api/pods/:namespace/:podName/exec
    const match = url.pathname.match(/^\/api\/pods\/([^/]+)\/([^/]+)\/exec\/?$/);
    if (!match) {
      // Not a pod terminal exec endpoint, do not handle
      return;
    }

    const namespace = decodeURIComponent(match[1]);
    const podName = decodeURIComponent(match[2]);

    const clusterParam = url.searchParams.get('cluster');
    const containerName = url.searchParams.get('container') || null;
    const shellPreference = url.searchParams.get('shell') || 'auto';
    const initialCols = parseInt(url.searchParams.get('cols'), 10) || 80;
    const initialRows = parseInt(url.searchParams.get('rows'), 10) || 24;

    const availableClusters = listClusters();
    const defaultId = getDefaultClusterId();
    const clusterId = clusterParam || defaultId;

    const clusterExists = availableClusters.some((c) => c.id === clusterId);
    if (!clusterExists) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\nUnknown cluster');
      socket.destroy();
      return;
    }

    let clients;
    try {
      clients = getClusterClients(clusterId);
    } catch (err) {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n' + err.message);
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (browserWs) => {
      handlePodTerminalSession({
        browserWs,
        clients,
        clusterId,
        namespace,
        podName,
        containerName,
        shellPreference,
        initialCols,
        initialRows,
      }).catch((err) => {
        console.error(`[Terminal] Unexpected session error: ${err.message}`);
        try {
          if (browserWs.readyState === browserWs.OPEN) {
            browserWs.send(JSON.stringify({ type: 'error', message: err.message }));
            browserWs.close(1011, 'Internal Error');
          }
        } catch (_) {}
      });
    });
  });

  return wss;
}

module.exports = { setupTerminalWebSocket };
