const daemonSetsService = require('../services/kubernetes/daemonsets.service');
const { sendList } = require('../utils/response');

async function getDaemonSets(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await daemonSetsService.listDaemonSets(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

module.exports = {
  getDaemonSets,
};
