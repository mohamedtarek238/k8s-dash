const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody, calculateAge } = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');

function mapNamespace(ns) {
  return {
    name: ns.metadata.name,
    status: ns.status?.phase || 'Unknown',
    creationTimestamp: ns.metadata.creationTimestamp,
    labels: ns.metadata.labels || {},
  };
}

function mapNamespaceDetails(ns, { relatedResources, events } = {}) {
  const phase = ns.status?.phase || 'Active';
  const data = {
    name: ns.metadata.name,
    uid: ns.metadata.uid,
    resourceVersion: ns.metadata.resourceVersion,
    creationTimestamp: ns.metadata.creationTimestamp,
    age: calculateAge(ns.metadata.creationTimestamp),
    phase,
    status: phase,
    labels: ns.metadata.labels || {},
    annotations: ns.metadata.annotations || {},
    finalizers: ns.spec?.finalizers || [],
    conditions: ns.status?.conditions || [],
  };

  if (relatedResources !== undefined) {
    data.related = relatedResources;
  }

  if (events !== undefined) {
    data.events = events;
  }

  return data;
}

async function listNamespaces() {
  const { coreV1Api } = initializeKubernetesClients();
  const response = await coreV1Api.listNamespace();
  return (getResponseBody(response).items || []).map(mapNamespace);
}

async function getNamespaceDetails(name, { includeRelated = false, includeEvents = false } = {}) {
  const { coreV1Api, appsV1Api } = initializeKubernetesClients();

  const response = await coreV1Api.readNamespace({ name });
  const ns = getResponseBody(response);

  let relatedResources;
  if (includeRelated) {
    const [podsRes, svcRes, deployRes, stsRes, dsRes] = await Promise.all([
      coreV1Api.listNamespacedPod({ namespace: name }).catch(() => ({ body: { items: [] } })),
      coreV1Api.listNamespacedService({ namespace: name }).catch(() => ({ body: { items: [] } })),
      appsV1Api.listNamespacedDeployment({ namespace: name }).catch(() => ({ body: { items: [] } })),
      appsV1Api.listNamespacedStatefulSet({ namespace: name }).catch(() => ({ body: { items: [] } })),
      appsV1Api.listNamespacedDaemonSet({ namespace: name }).catch(() => ({ body: { items: [] } })),
    ]);

    relatedResources = {
      resourceCounts: {
        pods: (getResponseBody(podsRes).items || []).length,
        services: (getResponseBody(svcRes).items || []).length,
        deployments: (getResponseBody(deployRes).items || []).length,
        statefulSets: (getResponseBody(stsRes).items || []).length,
        daemonSets: (getResponseBody(dsRes).items || []).length,
      },
    };
  }

  let events;
  if (includeEvents) {
    events = await getResourceEvents({ kind: 'Namespace', namespace: name, name, uid: ns.metadata?.uid });
  }

  return mapNamespaceDetails(ns, { relatedResources, events });
}

module.exports = {
  listNamespaces,
  getNamespaceDetails,
};

