const servicesService = require('../services/kubernetes/services.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getServices(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await servicesService.listServices(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getServiceDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await servicesService.getServiceDetails(namespace, name, { includeRelated, includeEvents });
  return sendSuccess(res, data);
}

async function getServiceYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('services', { namespace, name });
  return sendSuccess(res, data);
}

module.exports = {
  getServices,
  getServiceDetails,
  getServiceYaml,
};


