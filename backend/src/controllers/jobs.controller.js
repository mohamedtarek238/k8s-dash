const jobsService = require('../services/kubernetes/jobs.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getJobs(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await jobsService.listJobs(namespace, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getJobDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await jobsService.getJobDetails(namespace, name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getJobYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('jobs', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getJobs,
  getJobDetails,
  getJobYaml,
};
