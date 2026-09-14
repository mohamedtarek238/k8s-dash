const statefulSetsService = require('../services/kubernetes/statefulsets.service');
const { sendList } = require('../utils/response');

async function getStatefulSets(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await statefulSetsService.listStatefulSets(namespace);
  return sendList(res, data, namespace ? { namespace } : {});
}

module.exports = {
  getStatefulSets,
};
