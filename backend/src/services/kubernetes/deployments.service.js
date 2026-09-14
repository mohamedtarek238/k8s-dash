const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody } = require('../../utils/k8sHelpers');

function getDeploymentStatus(deployment) {
  const conditions = deployment.status?.conditions || [];
  const available = conditions.find((c) => c.type === 'Available');
  const progressing = conditions.find((c) => c.type === 'Progressing');

  if (available?.status === 'True') return 'Available';
  if (progressing?.status === 'False') return 'Failed';
  if (progressing?.status === 'True') return 'Progressing';
  return 'Unknown';
}

function mapDeploymentSummary(deployment) {
  const status = deployment.status || {};

  return {
    name: deployment.metadata.name,
    namespace: deployment.metadata.namespace,
    desiredReplicas: deployment.spec?.replicas ?? 0,
    availableReplicas: status.availableReplicas ?? 0,
    readyReplicas: status.readyReplicas ?? 0,
    updatedReplicas: status.updatedReplicas ?? 0,
    unavailableReplicas: status.unavailableReplicas ?? 0,
    status: getDeploymentStatus(deployment),
    creationTimestamp: deployment.metadata.creationTimestamp,
  };
}

function mapDeploymentDetails(deployment) {
  return {
    metadata: {
      name: deployment.metadata.name,
      namespace: deployment.metadata.namespace,
      uid: deployment.metadata.uid,
      labels: deployment.metadata.labels || {},
      annotations: deployment.metadata.annotations || {},
      creationTimestamp: deployment.metadata.creationTimestamp,
    },
    spec: {
      replicas: deployment.spec?.replicas,
      selector: deployment.spec?.selector,
      strategy: deployment.spec?.strategy,
      template: deployment.spec?.template,
    },
    status: deployment.status,
    summary: mapDeploymentSummary(deployment),
  };
}

async function listDeployments(namespace) {
  const { appsV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await appsV1Api.listNamespacedDeployment({ namespace })
    : await appsV1Api.listDeploymentForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapDeploymentSummary);
}

async function getDeploymentDetails(namespace, name) {
  const { appsV1Api } = initializeKubernetesClients();
  const response = await appsV1Api.readNamespacedDeployment({ name, namespace });
  return mapDeploymentDetails(getResponseBody(response));
}

module.exports = {
  listDeployments,
  getDeploymentDetails,
};
