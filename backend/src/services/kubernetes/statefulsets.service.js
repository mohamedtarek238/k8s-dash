const { initializeKubernetesClients } = require('../../config/kubernetes');
const {
  getResponseBody,
  calculateAge,
  mapContainers,
  getPodReadiness,
  getPodRestartCount,
} = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');

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

function mapStatefulSetDetails(statefulSet, { relatedPods, events } = {}) {
  const status = statefulSet.status || {};
  const template = statefulSet.spec?.template || {};
  const containers = mapContainers(template.spec?.containers || []);
  const images = (template.spec?.containers || []).map((c) => c.image).filter(Boolean);
  const ports = (template.spec?.containers || []).flatMap((c) => c.ports || []);

  const volumeInformation = {
    volumes: template.spec?.volumes || [],
    volumeClaimTemplates: (statefulSet.spec?.volumeClaimTemplates || []).map((vct) => ({
      name: vct.metadata?.name,
      labels: vct.metadata?.labels || {},
      annotations: vct.metadata?.annotations || {},
      storageClassName: vct.spec?.storageClassName || null,
      accessModes: vct.spec?.accessModes || [],
      storage: vct.spec?.resources?.requests?.storage || null,
    })),
  };

  const data = {
    name: statefulSet.metadata.name,
    namespace: statefulSet.metadata.namespace,
    uid: statefulSet.metadata.uid,
    resourceVersion: statefulSet.metadata.resourceVersion,
    creationTimestamp: statefulSet.metadata.creationTimestamp,
    age: calculateAge(statefulSet.metadata.creationTimestamp),
    status: getStatefulSetStatus(statefulSet),
    replicas: statefulSet.spec?.replicas ?? 0,
    readyReplicas: status.readyReplicas ?? 0,
    currentReplicas: status.currentReplicas ?? 0,
    updatedReplicas: status.updatedReplicas ?? 0,
    availableReplicas: status.availableReplicas ?? 0,
    selector: statefulSet.spec?.selector || {},
    serviceName: statefulSet.spec?.serviceName || null,
    podManagementPolicy: statefulSet.spec?.podManagementPolicy || 'OrderedReady',
    updateStrategy: statefulSet.spec?.updateStrategy || {},
    revisionHistoryLimit: statefulSet.spec?.revisionHistoryLimit ?? 10,
    template: {
      metadata: {
        labels: template.metadata?.labels || {},
        annotations: template.metadata?.annotations || {},
      },
    },
    templateMetadata: {
      labels: template.metadata?.labels || {},
      annotations: template.metadata?.annotations || {},
    },
    containers,
    images,
    ports,
    volumes: template.spec?.volumes || [],
    volumeInformation,
    conditions: status.conditions || [],
    labels: statefulSet.metadata.labels || {},
    annotations: statefulSet.metadata.annotations || {},
    ownerReferences: statefulSet.metadata.ownerReferences || [],
  };

  if (relatedPods !== undefined) {
    data.related = {
      pods: relatedPods,
      totalPods: relatedPods.length,
    };
  }

  if (events !== undefined) {
    data.events = events;
  }

  return data;
}

async function listStatefulSets(namespace) {
  const { appsV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await appsV1Api.listNamespacedStatefulSet({ namespace })
    : await appsV1Api.listStatefulSetForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapStatefulSet);
}

async function getStatefulSetDetails(namespace, name, { includeRelated = false, includeEvents = false } = {}) {
  const { appsV1Api, coreV1Api } = initializeKubernetesClients();

  const response = await appsV1Api.readNamespacedStatefulSet({ name, namespace });
  const statefulSet = getResponseBody(response);

  let relatedPods;
  if (includeRelated) {
    const matchLabels = statefulSet.spec?.selector?.matchLabels || {};
    const entries = Object.entries(matchLabels);
    if (entries.length > 0) {
      const labelSelector = entries.map(([k, v]) => `${k}=${v}`).join(',');
      const podsResponse = await coreV1Api.listNamespacedPod({ namespace, labelSelector });
      const podItems = getResponseBody(podsResponse).items || [];
      relatedPods = podItems.map((p) => ({
        name: p.metadata.name,
        namespace: p.metadata.namespace,
        status: p.status?.phase || 'Unknown',
        podIP: p.status?.podIP || null,
        nodeName: p.spec?.nodeName || null,
        readiness: getPodReadiness(p),
        restartCount: getPodRestartCount(p),
        creationTimestamp: p.metadata.creationTimestamp,
        age: calculateAge(p.metadata.creationTimestamp),
      }));
    } else {
      relatedPods = [];
    }
  }

  let events;
  if (includeEvents) {
    events = await getResourceEvents({ kind: 'StatefulSet', namespace, name, uid: statefulSet.metadata?.uid });
  }

  return mapStatefulSetDetails(statefulSet, { relatedPods, events });
}

module.exports = {
  listStatefulSets,
  getStatefulSetDetails,
};

