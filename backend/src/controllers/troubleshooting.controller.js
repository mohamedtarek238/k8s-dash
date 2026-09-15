const diagnosticsService = require('../services/kubernetes/diagnostics.service');
const { sendSuccess } = require('../utils/response');

async function getTroubleshooting(req, res) {
  const data = await diagnosticsService.getTroubleshootingReport(req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getTroubleshooting,
};
