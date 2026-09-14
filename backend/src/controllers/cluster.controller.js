const clusterService = require('../services/kubernetes/cluster.service');
const { sendSuccess } = require('../utils/response');

async function getCluster(_req, res) {
  const data = await clusterService.getClusterOverview();
  return sendSuccess(res, data);
}

module.exports = {
  getCluster,
};
