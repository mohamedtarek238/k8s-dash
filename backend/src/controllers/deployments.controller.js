const deploymentsService = require('../services/kubernetes/deployments.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getDeployments(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await deploymentsService.listDeployments(namespace, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getDeploymentDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await deploymentsService.getDeploymentDetails(namespace, name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getDeploymentYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('deployments', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getDeployments,
  getDeploymentDetails,
  getDeploymentYaml,
};

