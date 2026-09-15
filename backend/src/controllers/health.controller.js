const diagnosticsService = require('../services/kubernetes/diagnostics.service');
const { sendSuccess } = require('../utils/response');

async function getHealth(req, res) {
  const data = await diagnosticsService.getClusterHealth(req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getHealth,
};
