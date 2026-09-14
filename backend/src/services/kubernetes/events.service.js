const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody, sortEventsByRecency, involvedObjectToString } = require('../../utils/k8sHelpers');

function mapEvent(event) {
  return {
    namespace: event.metadata.namespace,
    name: event.metadata.name,
    type: event.type,
    reason: event.reason,
    message: event.message,
    involvedObject: {
      kind: event.involvedObject?.kind,
      namespace: event.involvedObject?.namespace,
      name: event.involvedObject?.name,
      uid: event.involvedObject?.uid,
      display: involvedObjectToString(event.involvedObject),
    },
    source: event.source,
    firstTimestamp: event.firstTimestamp,
    lastTimestamp: event.lastTimestamp,
    count: event.count,
  };
}

async function listEvents(namespace) {
  const { coreV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await coreV1Api.listNamespacedEvent({ namespace })
    : await coreV1Api.listEventForAllNamespaces();

  const events = (getResponseBody(response).items || []).map(mapEvent);
  return sortEventsByRecency(events);
}

async function getResourceEvents({ kind, namespace, name, uid } = {}) {
  const { coreV1Api } = initializeKubernetesClients();
  let rawEvents = [];

  if (namespace) {
    const response = await coreV1Api.listNamespacedEvent({ namespace });
    const items = getResponseBody(response).items || [];
    rawEvents = items.filter((event) => {
      const obj = event.involvedObject;
      if (!obj) return false;
      if (name && obj.name !== name) return false;
      if (kind && obj.kind?.toLowerCase() !== kind.toLowerCase()) return false;
      if (uid && obj.uid && obj.uid !== uid) return false;
      return true;
    });
  } else {
    let fieldSelector;
    if (kind && name) {
      fieldSelector = `involvedObject.kind=${kind},involvedObject.name=${name}`;
    } else if (name) {
      fieldSelector = `involvedObject.name=${name}`;
    }
    const response = await coreV1Api.listEventForAllNamespaces({ fieldSelector });
    rawEvents = getResponseBody(response).items || [];
    if (uid) {
      rawEvents = rawEvents.filter((e) => !e.involvedObject?.uid || e.involvedObject.uid === uid);
    }
  }

  const mapped = rawEvents.map(mapEvent);
  return sortEventsByRecency(mapped);
}

module.exports = {
  mapEvent,
  listEvents,
  getResourceEvents,
};

