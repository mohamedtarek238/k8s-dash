const {
  initializeKubernetesClients,
  getCurrentContext,
  getCurrentCluster,
  getClusterServer,
} = require('../../config/kubernetes');
const { getResponseBody, isNodeReady } = require('../../utils/k8sHelpers');

async function getClusterOverview() {
  const { coreV1Api, appsV1Api, versionApi } = initializeKubernetesClients();

  const [versionInfo, nodes, namespaces, pods, deployments, services] = await Promise.all([
    versionApi.getCode(),
    coreV1Api.listNode(),
    coreV1Api.listNamespace(),
    coreV1Api.listPodForAllNamespaces(),
    appsV1Api.listDeploymentForAllNamespaces(),
    coreV1Api.listServiceForAllNamespaces(),
  ]);

  const nodeItems = getResponseBody(nodes).items || [];
  const readyNodes = nodeItems.filter(isNodeReady).length;
  const notReadyNodes = nodeItems.length - readyNodes;

  let healthStatus = 'healthy';
  if (notReadyNodes > 0) {
    healthStatus = notReadyNodes === nodeItems.length ? 'critical' : 'warning';
  }

  return {
    context: getCurrentContext(),
    cluster: getCurrentCluster(),
    server: getClusterServer(),
    version: getResponseBody(versionInfo),
    nodes: {
      total: nodeItems.length,
      ready: readyNodes,
      notReady: notReadyNodes,
    },
    namespaces: (getResponseBody(namespaces).items || []).length,
    pods: (getResponseBody(pods).items || []).length,
    deployments: (getResponseBody(deployments).items || []).length,
    services: (getResponseBody(services).items || []).length,
    health: {
      status: healthStatus,
      message:
        healthStatus === 'healthy'
          ? 'All nodes are ready'
          : `${notReadyNodes} node(s) are not ready`,
    },
  };
}

async function checkConnection() {
  const { versionApi } = initializeKubernetesClients();
  await versionApi.getCode();
  return true;
}

module.exports = {
  getClusterOverview,
  checkConnection,
};
