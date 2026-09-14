const nodesService = require('../services/kubernetes/nodes.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getNodes(_req, res) {
  const data = await nodesService.listNodes();
  return sendList(res, data);
}

async function getNodeDetails(req, res) {
  const { name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await nodesService.getNodeDetails(name, { includeRelated, includeEvents });
  return sendSuccess(res, data);
}

module.exports = {
  getNodes,
  getNodeDetails,
};

