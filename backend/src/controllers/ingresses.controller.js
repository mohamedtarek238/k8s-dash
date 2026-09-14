const ingressesService = require('../services/kubernetes/ingresses.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getIngresses(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await ingressesService.listIngresses(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getIngressDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await ingressesService.getIngressDetails(namespace, name, { includeRelated, includeEvents });
  return sendSuccess(res, data);
}

module.exports = {
  getIngresses,
  getIngressDetails,
};

