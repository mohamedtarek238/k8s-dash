const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody } = require('../../utils/k8sHelpers');

function getStatefulSetStatus(statefulSet) {
  const desired = statefulSet.spec?.replicas ?? 0;
  const ready = statefulSet.status?.readyReplicas ?? 0;

  if (ready === desired && desired > 0) return 'Ready';
  if (ready > 0) return 'PartiallyReady';
  return 'NotReady';
}

function mapStatefulSet(statefulSet) {
  const status = statefulSet.status || {};

  return {
    name: statefulSet.metadata.name,
    namespace: statefulSet.metadata.namespace,
    replicas: statefulSet.spec?.replicas ?? 0,
    readyReplicas: status.readyReplicas ?? 0,
    currentReplicas: status.currentReplicas ?? 0,
    updatedReplicas: status.updatedReplicas ?? 0,
    status: getStatefulSetStatus(statefulSet),
    creationTimestamp: statefulSet.metadata.creationTimestamp,
  };
}

async function listStatefulSets(namespace) {
  const { appsV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await appsV1Api.listNamespacedStatefulSet({ namespace })
    : await appsV1Api.listStatefulSetForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapStatefulSet);
}

module.exports = {
  listStatefulSets,
};
