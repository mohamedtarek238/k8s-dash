const clusterService = require('../services/kubernetes/cluster.service');
const { sendSuccess } = require('../utils/response');

async function getCluster(req, res) {
  const data = await clusterService.getClusterOverview(req.k8sClients, req.clusterMeta);
  return sendSuccess(res, data);
}

module.exports = {
  getCluster,
};
