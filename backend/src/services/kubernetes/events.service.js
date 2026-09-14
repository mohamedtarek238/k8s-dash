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

module.exports = {
  listEvents,
};
