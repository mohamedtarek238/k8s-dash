const podsService = require('../services/kubernetes/pods.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getPods(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await podsService.listPods(namespace, req.k8sClients);
  return sendList(res, data, namespace ? { namespace } : {});
}

async function getPodDetails(req, res) {
  const { namespace, podName } = req.validatedParams;
  const data = await podsService.getPodDetails(namespace, podName, req.k8sClients);
  return sendSuccess(res, data);
}

async function getPodLogs(req, res) {
  const { namespace, podName } = req.validatedParams;
  const { container, tailLines, previous } = req.validatedQuery || {};
  const data = await podsService.getPodLogs(namespace, podName, {
    container,
    tailLines,
    previous,
  }, req.k8sClients);
  return sendSuccess(res, data);
}

async function getPodYaml(req, res) {
  const { namespace, podName } = req.validatedParams;
  const data = await yamlService.getResourceYaml('pods', { namespace, name: podName }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getPods,
  getPodDetails,
  getPodLogs,
  getPodYaml,
};

