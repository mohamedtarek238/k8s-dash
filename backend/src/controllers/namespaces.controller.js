const namespacesService = require('../services/kubernetes/namespaces.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getNamespaces(req, res) {
  const data = await namespacesService.listNamespaces(req.k8sClients);
  return sendList(res, data);
}

async function getNamespaceDetails(req, res) {
  const { name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await namespacesService.getNamespaceDetails(name, { includeRelated, includeEvents }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getNamespaceYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('namespaces', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getNamespaces,
  getNamespaceDetails,
  getNamespaceYaml,
};


