const { listClusters, getClusterMeta } = require('../config/kubernetes');
const { sendSuccess, sendList, sendError } = require('../utils/response');

async function getClusters(_req, res) {
  const clusters = listClusters();
  return sendList(res, clusters);
}

async function getClusterById(req, res) {
  const { clusterId } = req.params;
  const meta = getClusterMeta(clusterId);

  if (!meta) {
    return sendError(res, 404, 'Not Found', `Cluster "${clusterId}" not found`);
  }

  return sendSuccess(res, meta);
}

module.exports = {
  getClusters,
  getClusterById,
};
