const cronJobsService = require('../services/kubernetes/cronjobs.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getCronJobs(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await cronJobsService.listCronJobs(namespace, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getCronJobDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await cronJobsService.getCronJobDetails(namespace, name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getCronJobYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('cronjobs', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getCronJobs,
  getCronJobDetails,
  getCronJobYaml,
};
