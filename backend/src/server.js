const { createApp } = require('./app');
const { getCurrentContext, getClusterServer, listClusters, getDefaultClusterId } = require('./config/kubernetes');
const { setupTerminalWebSocket } = require('./websocket/terminal.handler');

const PORT = process.env.PORT || 5000;

const app = createApp();

const server = app.listen(PORT, () => {
  const clusters = listClusters();
  const defaultId = getDefaultClusterId();

  console.log(`Kubernetes Dashboard Backend running on http://localhost:${PORT}`);
  console.log(`Loaded ${clusters.length} cluster(s):`);
  clusters.forEach((c) => {
    const marker = c.id === defaultId ? ' (default)' : '';
    console.log(`  - ${c.id}: ${c.server} [context: ${c.context}]${marker}`);
  });
  console.log(`Health check: http://localhost:${PORT}/api/status`);
});

setupTerminalWebSocket(server);
