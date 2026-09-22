const metricsService = require('../services/kubernetes/metrics.service');
const { sendSuccess } = require('../utils/response');

async function getClusterMetrics(req, res) {
  const data = await metricsService.getClusterMetrics(req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getClusterMetrics,
};
