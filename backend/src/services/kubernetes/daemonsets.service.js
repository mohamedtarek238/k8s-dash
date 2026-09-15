const {
  getResponseBody,
  calculateAge,
  mapContainers,
  getPodReadiness,
  getPodRestartCount,
} = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');

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

function mapDaemonSetDetails(daemonSet, { relatedPods, events } = {}) {
  const status = daemonSet.status || {};
  const template = daemonSet.spec?.template || {};
  const containers = mapContainers(template.spec?.containers || []);
  const images = (template.spec?.containers || []).map((c) => c.image).filter(Boolean);
  const ports = (template.spec?.containers || []).flatMap((c) => c.ports || []);

  const data = {
    name: daemonSet.metadata.name,
    namespace: daemonSet.metadata.namespace,
    uid: daemonSet.metadata.uid,
    resourceVersion: daemonSet.metadata.resourceVersion,
    creationTimestamp: daemonSet.metadata.creationTimestamp,
    age: calculateAge(daemonSet.metadata.creationTimestamp),
    status: getDaemonSetStatus(daemonSet),
    desiredNumberScheduled: status.desiredNumberScheduled ?? 0,
    currentNumberScheduled: status.currentNumberScheduled ?? 0,
    numberReady: status.numberReady ?? 0,
    updatedNumberScheduled: status.updatedNumberScheduled ?? 0,
    numberAvailable: status.numberAvailable ?? 0,
    numberUnavailable: status.numberUnavailable ?? 0,
    numberMisscheduled: status.numberMisscheduled ?? 0,
    selector: daemonSet.spec?.selector || {},
    updateStrategy: daemonSet.spec?.updateStrategy || {},
    revisionHistoryLimit: daemonSet.spec?.revisionHistoryLimit ?? 10,
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
    conditions: status.conditions || [],
    labels: daemonSet.metadata.labels || {},
    annotations: daemonSet.metadata.annotations || {},
    ownerReferences: daemonSet.metadata.ownerReferences || [],
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

async function listDaemonSets(namespace, clients) {
  const { appsV1Api } = clients;

  const response = namespace
    ? await appsV1Api.listNamespacedDaemonSet({ namespace })
    : await appsV1Api.listDaemonSetForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapDaemonSet);
}

async function getDaemonSetDetails(namespace, name, { includeRelated = false, includeEvents = false } = {}, clients) {
  const { appsV1Api, coreV1Api } = clients;

  const response = await appsV1Api.readNamespacedDaemonSet({ name, namespace });
  const daemonSet = getResponseBody(response);

  let relatedPods;
  if (includeRelated) {
    const matchLabels = daemonSet.spec?.selector?.matchLabels || {};
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
    events = await getResourceEvents({ kind: 'DaemonSet', namespace, name, uid: daemonSet.metadata?.uid }, clients);
  }

  return mapDaemonSetDetails(daemonSet, { relatedPods, events });
}

module.exports = {
  listDaemonSets,
  getDaemonSetDetails,
};

