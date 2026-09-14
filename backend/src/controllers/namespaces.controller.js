const namespacesService = require('../services/kubernetes/namespaces.service');
const { sendList } = require('../utils/response');

async function getNamespaces(_req, res) {
  const data = await namespacesService.listNamespaces();
  return sendList(res, data);
}

module.exports = {
  getNamespaces,
};
