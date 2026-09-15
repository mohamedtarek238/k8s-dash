const nodesService = require('../services/kubernetes/nodes.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getNodes(req, res) {
  const data = await nodesService.listNodes(req.k8sClients);
  return sendList(res, data);
}

async function getNodeDetails(req, res) {
  const { name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await nodesService.getNodeDetails(name, { includeRelated, includeEvents }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getNodeYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('nodes', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getNodes,
  getNodeDetails,
  getNodeYaml,
};


