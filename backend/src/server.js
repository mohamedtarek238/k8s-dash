const { createApp } = require('./app');
const { getCurrentContext, getClusterServer } = require('./config/kubernetes');

const PORT = process.env.PORT || 5000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Kubernetes Dashboard Backend running on http://localhost:${PORT}`);
  console.log(`Active Kubernetes context: ${getCurrentContext()}`);
  console.log(`Cluster server: ${getClusterServer() || 'unknown'}`);
  console.log(`Health check: http://localhost:${PORT}/api/status`);
});
