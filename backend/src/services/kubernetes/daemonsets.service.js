const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody } = require('../../utils/k8sHelpers');

function getDaemonSetStatus(daemonSet) {
  const desired = daemonSet.status?.desiredNumberScheduled ?? 0;
  const ready = daemonSet.status?.numberReady ?? 0;

  if (desired === 0) return 'Unknown';
  if (ready === desired) return 'Ready';
  if (ready > 0) return 'PartiallyReady';
  return 'NotReady';
}

function mapDaemonSet(daemonSet) {
  const status = daemonSet.status || {};

  return {
    name: daemonSet.metadata.name,
    namespace: daemonSet.metadata.namespace,
    desiredNumberScheduled: status.desiredNumberScheduled ?? 0,
    currentNumberScheduled: status.currentNumberScheduled ?? 0,
    numberReady: status.numberReady ?? 0,
    numberAvailable: status.numberAvailable ?? 0,
    numberUnavailable: status.numberUnavailable ?? 0,
    status: getDaemonSetStatus(daemonSet),
    creationTimestamp: daemonSet.metadata.creationTimestamp,
  };
}

async function listDaemonSets(namespace) {
  const { appsV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await appsV1Api.listNamespacedDaemonSet({ namespace })
    : await appsV1Api.listDaemonSetForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapDaemonSet);
}

module.exports = {
  listDaemonSets,
};
