const ingressesService = require('../services/kubernetes/ingresses.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getIngresses(req, res) {
  const { namespace, includeKong } = req.validatedQuery || {};
  const data = await ingressesService.listIngresses(namespace, { includeKong }, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getIngressDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents, includeKong } = req.validatedQuery || {};
  const data = await ingressesService.getIngressDetails(namespace, name, { includeRelated, includeEvents, includeKong }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getIngressYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('ingresses', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getIngresses,
  getIngressDetails,
  getIngressYaml,
};


