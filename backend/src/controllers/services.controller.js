const servicesService = require('../services/kubernetes/services.service');
const { sendList } = require('../utils/response');

async function getServices(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await servicesService.listServices(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

module.exports = {
  getServices,
};
