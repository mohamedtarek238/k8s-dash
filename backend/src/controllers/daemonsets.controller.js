const daemonSetsService = require('../services/kubernetes/daemonsets.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getDaemonSets(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await daemonSetsService.listDaemonSets(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getDaemonSetDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeRelated, includeEvents } = req.validatedQuery || {};
  const data = await daemonSetsService.getDaemonSetDetails(namespace, name, { includeRelated, includeEvents });
  return sendSuccess(res, data);
}

module.exports = {
  getDaemonSets,
  getDaemonSetDetails,
};

