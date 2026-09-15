const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess } = require('../utils/response');

async function getNamespacedResourceYaml(req, res) {
  const { resourceType, namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml(resourceType, { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getClusterResourceYaml(req, res) {
  const { resourceType, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml(resourceType, { name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getNamespacedResourceYaml,
  getClusterResourceYaml,
};
