const namespacesService = require('../services/kubernetes/namespaces.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getNamespaces(_req, res) {
  const data = await namespacesService.listNamespaces();
  return sendList(res, data);
}

async function getNamespaceDetails(req, res) {
  const { name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await namespacesService.getNamespaceDetails(name, { includeRelated, includeEvents });
  return sendSuccess(res, data);
}

module.exports = {
  getNamespaces,
  getNamespaceDetails,
};

