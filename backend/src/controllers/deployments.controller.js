const deploymentsService = require('../services/kubernetes/deployments.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getDeployments(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await deploymentsService.listDeployments(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getDeploymentDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await deploymentsService.getDeploymentDetails(namespace, name);
  return sendSuccess(res, data);
}

module.exports = {
  getDeployments,
  getDeploymentDetails,
};
