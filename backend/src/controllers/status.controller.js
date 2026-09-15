const clusterService = require('../services/kubernetes/cluster.service');
const { sendSuccess } = require('../utils/response');

async function getStatus(req, res) {
  try {
    await clusterService.checkConnection(req.k8sClients);
    return sendSuccess(res, {
      backend: 'ok',
      kubernetes: 'connected',
    });
  } catch {
    return sendSuccess(res, {
      backend: 'ok',
      kubernetes: 'disconnected',
    });
  }
}

module.exports = {
  getStatus,
};
