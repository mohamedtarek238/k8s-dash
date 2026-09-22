import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Maximize2,
  Minimize2,
  RefreshCw,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../api';

const darkTheme = {
  background: '#090d16',
  foreground: '#f1f5f9',
  cursor: '#38bdf8',
  selectionBackground: '#1e293b',
  black: '#0f172a',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#d946ef',
  cyan: '#06b6d4',
  white: '#f8fafc',
};

const lightTheme = {
  background: '#ffffff',
  foreground: '#0f172a',
  cursor: '#0284c7',
  selectionBackground: '#e2e8f0',
  black: '#0f172a',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#d97706',
  blue: '#2563eb',
  magenta: '#c026d3',
  cyan: '#0891b2',
  white: '#f8fafc',
};

export function PodTerminal({ pod, podDetail, onClose, dark = true }) {
  const currentCluster = api.getCluster();
  const terminalRef = useRef(null);
  const termInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);

  // Extract all containers
  const containers = [
    ...(podDetail?.spec?.containers || pod?.containers || []),
    ...(podDetail?.spec?.initContainers || []),
  ];

  const containerStatuses = [
    ...(podDetail?.status?.containerStatuses || []),
    ...(podDetail?.status?.initContainerStatuses || []),
  ];

  // Pick initial running container or first available
  const initialContainer = (() => {
    const running = containerStatuses.find((c) => c.state?.running);
    if (running) return running.name;
    return containers[0]?.name || '';
  })();

  const [selectedContainer, setSelectedContainer] = useState(initialContainer);
  const [selectedShell, setSelectedShell] = useState('auto');
  const [status, setStatus] = useState('connecting'); // connecting, connected, disconnected, error
  const [statusMessage, setStatusMessage] = useState('Initializing terminal session...');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Find status for currently selected container
  const currentContainerStatus = containerStatuses.find((c) => c.name === selectedContainer);
  const isContainerRunning = currentContainerStatus ? Boolean(currentContainerStatus.state?.running) : true;

  const getContainerStateBadge = (cName) => {
    const cs = containerStatuses.find((c) => c.name === cName);
    if (!cs) return null;
    if (cs.state?.running) return <span className="term-pill green">Running</span>;
    if (cs.state?.waiting) return <span className="term-pill amber">{cs.state.waiting.reason || 'Waiting'}</span>;
    if (cs.state?.terminated) return <span className="term-pill red">{cs.state.terminated.reason || 'Terminated'}</span>;
    return null;
  };

  const connectTerminal = () => {
    // Teardown any existing connection & terminal
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }

    if (termInstanceRef.current) {
      try {
        termInstanceRef.current.dispose();
      } catch (_) {}
      termInstanceRef.current = null;
    }

    if (!terminalRef.current) return;

    setStatus('connecting');
    setStatusMessage('Connecting to Pod container...');
    setErrorMessage(null);

    // Initialize xterm
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: dark ? darkTheme : lightTheme,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    term.focus();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    try {
      fitAddon.fit();
    } catch (_) {}

    // Determine initial dimensions
    const cols = term.cols || 80;
    const rows = term.rows || 24;

    // Build WebSocket URL
    const apiUrl = api.url || 'http://localhost:5100';
    const wsProto = apiUrl.startsWith('https:') || window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = apiUrl.replace(/^https?:\/\//, '');

    const params = new URLSearchParams({
      cols: String(cols),
      rows: String(rows),
      shell: selectedShell,
    });
    if (currentCluster) params.set('cluster', currentCluster);
    if (selectedContainer) params.set('container', selectedContainer);

    const wsUrl = `${wsProto}//${host}/api/pods/${encodeURIComponent(pod.namespace)}/${encodeURIComponent(pod.name)}/exec?${params.toString()}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setStatusMessage('WebSocket handshake established...');
      setTimeout(() => term.focus(), 50);
    };

    ws.onmessage = (event) => {
      const data = event.data;

      // Handle binary stream (raw stdout/stderr from Kubernetes exec container)
      if (data instanceof ArrayBuffer) {
        term.write(new Uint8Array(data));
        return;
      }

      // Handle Blob fallback
      if (data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            term.write(new Uint8Array(reader.result));
          }
        };
        reader.readAsArrayBuffer(data);
        return;
      }

      // Handle string frame (JSON control message or raw string)
      if (typeof data === 'string') {
        if (data.startsWith('{') && data.endsWith('}')) {
          try {
            const msg = JSON.parse(data);
            if (msg.type === 'status') {
              setStatus(msg.status);
              setStatusMessage(msg.message);
              if (msg.status === 'connected') {
                setTimeout(() => term.focus(), 50);
              }
              return;
            }
            if (msg.type === 'error') {
              setStatus('error');
              setErrorMessage(msg.message);
              term.writeln(`\r\n\x1b[31;1m● Error: ${msg.message}\x1b[0m\r\n`);
              return;
            }
            if (msg.type === 'exit') {
              setStatus('disconnected');
              setStatusMessage(`Process exited (code ${msg.code})`);
              term.writeln(`\r\n\x1b[33m● ${msg.message || 'Process terminated'}\x1b[0m\r\n`);
              return;
            }
          } catch (_) {
            // Not a control message, write directly to terminal
          }
        }
        term.write(data);
      }
    };

    ws.onclose = (event) => {
      if (status !== 'error') {
        setStatus('disconnected');
        setStatusMessage(event.reason ? `Disconnected: ${event.reason}` : 'Session closed');
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMessage('WebSocket connection failed. Ensure backend is reachable and Kubernetes credentials have pods/exec permissions.');
    };

    // Forward keystrokes and inputs directly to remote stdin
    term.onData((input) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(input);
      }
    });

    // Auto-fit and focus after layout stabilizes
    setTimeout(() => {
      try {
        fitAddon.fit();
        term.focus();
        if (ws.readyState === WebSocket.OPEN && term.cols && term.rows) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch (_) {}
    }, 120);
  };

  useEffect(() => {
    connectTerminal();

    const handleResize = () => {
      if (!fitAddonRef.current || !termInstanceRef.current) return;
      try {
        fitAddonRef.current.fit();
        const { cols, rows } = termInstanceRef.current;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && cols && rows) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      } catch (_) {}
    };

    window.addEventListener('resize', handleResize);

    // Setup ResizeObserver on canvas container for smooth layout adapting
    let resizeObserver = null;
    if (terminalRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (_) {}
      }
      if (termInstanceRef.current) {
        try {
          termInstanceRef.current.dispose();
        } catch (_) {}
      }
    };
  }, [pod.namespace, pod.name, selectedContainer, selectedShell, currentCluster]);

  const handleClear = () => {
    termInstanceRef.current?.clear();
    termInstanceRef.current?.focus();
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
    }
  };

  return (
    <div className="terminal-modal-backdrop" onClick={onClose}>
      <div
        className={`terminal-modal-window ${isMaximized ? 'maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="terminal-modal-header">
          <div className="terminal-header-title">
            <div className="terminal-title-icon">
              <TerminalIcon size={17} />
            </div>
            <div>
              <div className="terminal-title-line">
                <strong>Terminal — {pod.name}</strong>
                <span className={`terminal-status-dot ${status}`} title={statusMessage} />
                <span className="terminal-status-text">{statusMessage}</span>
              </div>
              <div className="terminal-meta-line">
                <span>Namespace: <strong className="mono">{pod.namespace}</strong></span>
                <span>Cluster: <strong>{currentCluster || 'default'}</strong></span>
              </div>
            </div>
          </div>

          <div className="terminal-controls-group">
            {/* Container Selector */}
            <div className="terminal-select-wrap" title="Select container">
              <label>Container:</label>
              <select
                value={selectedContainer}
                onChange={(e) => setSelectedContainer(e.target.value)}
                className="terminal-select"
              >
                {containers.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shell Selector */}
            <div className="terminal-select-wrap" title="Shell executable">
              <label>Shell:</label>
              <select
                value={selectedShell}
                onChange={(e) => setSelectedShell(e.target.value)}
                className="terminal-select"
              >
                <option value="auto">Auto (bash / sh)</option>
                <option value="/bin/bash">/bin/bash</option>
                <option value="/bin/sh">/bin/sh</option>
              </select>
            </div>

            {/* Session Action Buttons */}
            {status === 'connected' ? (
              <button className="term-btn" onClick={handleDisconnect} title="Disconnect session">
                <Square size={13} /> Disconnect
              </button>
            ) : (
              <button className="term-btn primary" onClick={connectTerminal} title="Reconnect terminal session">
                <RefreshCw size={13} /> Reconnect
              </button>
            )}

            <button className="term-btn" onClick={handleClear} title="Clear terminal screen">
              <Trash2 size={13} /> Clear
            </button>

            <button
              className="term-icon-btn"
              onClick={() => {
                setIsMaximized(!isMaximized);
                setTimeout(() => fitAddonRef.current?.fit(), 150);
              }}
              title={isMaximized ? 'Restore size' : 'Maximize terminal'}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button className="term-icon-btn close" onClick={onClose} title="Close terminal">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Informational Notification if container not running */}
        {!isContainerRunning && (
          <div className="terminal-alert-bar">
            <AlertCircle size={15} />
            <span>
              Container <strong>"{selectedContainer}"</strong> is currently not running. Exec sessions require a running container.
            </span>
          </div>
        )}

        {/* Terminal Screen Body */}
        <div
          className="terminal-screen-wrapper"
          onClick={() => termInstanceRef.current?.focus()}
        >
          <div
            className="terminal-canvas-container"
            ref={terminalRef}
            onClick={() => termInstanceRef.current?.focus()}
          />
        </div>

        {/* Footer Security Notice */}
        <div className="terminal-footer-bar">
          <span>
            Kubernetes Pod Exec mode active. Commands execute inside container <strong>{selectedContainer}</strong> using your current cluster credentials.
          </span>
          <span className="mono">Ctrl+C / Ctrl+D supported</span>
        </div>
      </div>
    </div>
  );
}
