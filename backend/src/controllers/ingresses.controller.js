const ingressesService = require('../services/kubernetes/ingresses.service');
const { sendList } = require('../utils/response');

async function getIngresses(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await ingressesService.listIngresses(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

module.exports = {
  getIngresses,
};
