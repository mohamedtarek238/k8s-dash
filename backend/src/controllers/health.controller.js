const diagnosticsService = require('../services/kubernetes/diagnostics.service');
const { sendSuccess } = require('../utils/response');

async function getHealth(_req, res) {
  const data = await diagnosticsService.getClusterHealth();
  return sendSuccess(res, data);
}

module.exports = {
  getHealth,
};
