const diagnosticsService = require('../services/kubernetes/diagnostics.service');
const { sendSuccess } = require('../utils/response');

async function getTroubleshooting(_req, res) {
  const data = await diagnosticsService.getTroubleshootingReport();
  return sendSuccess(res, data);
}

module.exports = {
  getTroubleshooting,
};
