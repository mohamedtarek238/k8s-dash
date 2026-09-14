const statefulSetsService = require('../services/kubernetes/statefulsets.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getStatefulSets(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await statefulSetsService.listStatefulSets(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getStatefulSetDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await statefulSetsService.getStatefulSetDetails(namespace, name, { includeRelated, includeEvents });
  return sendSuccess(res, data);
}

async function getStatefulSetYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('statefulsets', { namespace, name });
  return sendSuccess(res, data);
}

module.exports = {
  getStatefulSets,
  getStatefulSetDetails,
  getStatefulSetYaml,
};


