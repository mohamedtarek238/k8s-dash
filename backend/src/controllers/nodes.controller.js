const nodesService = require('../services/kubernetes/nodes.service');
const { sendList } = require('../utils/response');

async function getNodes(_req, res) {
  const data = await nodesService.listNodes();
  return sendList(res, data);
}

module.exports = {
  getNodes,
};
