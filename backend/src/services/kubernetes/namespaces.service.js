const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody } = require('../../utils/k8sHelpers');

function mapNamespace(ns) {
  return {
    name: ns.metadata.name,
    status: ns.status?.phase || 'Unknown',
    creationTimestamp: ns.metadata.creationTimestamp,
    labels: ns.metadata.labels || {},
  };
}

async function listNamespaces() {
  const { coreV1Api } = initializeKubernetesClients();
  const response = await coreV1Api.listNamespace();
  return (getResponseBody(response).items || []).map(mapNamespace);
}

module.exports = {
  listNamespaces,
};
