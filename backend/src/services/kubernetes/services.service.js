const {
  getResponseBody,
  calculateAge,
  formatServicePort,
  getPodReadiness,
  getPodRestartCount,
} = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');

function mapService(service) {
  const loadBalancerIPs = (service.status?.loadBalancer?.ingress || [])
    .map((ingress) => ingress.ip || ingress.hostname)
    .filter(Boolean);

  return {
    name: service.metadata.name,
    namespace: service.metadata.namespace,
    type: service.spec?.type || 'ClusterIP',
    clusterIP: service.spec?.clusterIP ?? null,
    externalIPs: loadBalancerIPs.length ? loadBalancerIPs : service.spec?.externalIPs || [],
    ports: (service.spec?.ports || []).map((p) => ({
      name: p.name,
      port: p.port,
      targetPort: p.targetPort,
      protocol: p.protocol,
      nodePort: p.nodePort,
    })),
    selector: service.spec?.selector || {},
    creationTimestamp: service.metadata.creationTimestamp,
  };
}

function mapServiceDetails(service, endpoints, { relatedPods, events } = {}) {
  const loadBalancerIngress = (service.status?.loadBalancer?.ingress || []).map((ing) => ({
    ip: ing.ip || null,
    hostname: ing.hostname || null,
  }));
  const lbAddresses = loadBalancerIngress.map((ing) => ing.ip || ing.hostname).filter(Boolean);
  const externalIPs = lbAddresses.length ? lbAddresses : service.spec?.externalIPs || [];

  const ports = (service.spec?.ports || []).map((p) => ({
    name: p.name || null,
    port: p.port,
    targetPort: p.targetPort,
    nodePort: p.nodePort || null,
    protocol: p.protocol || 'TCP',
    display: formatServicePort(p),
  }));

  const primaryPort = ports[0] || null;

  const data = {
    name: service.metadata.name,
    namespace: service.metadata.namespace,
    uid: service.metadata.uid,
    resourceVersion: service.metadata.resourceVersion,
    creationTimestamp: service.metadata.creationTimestamp,
    age: calculateAge(service.metadata.creationTimestamp),
    type: service.spec?.type || 'ClusterIP',
    clusterIP: service.spec?.clusterIP ?? null,
    clusterIPs: service.spec?.clusterIPs || (service.spec?.clusterIP ? [service.spec.clusterIP] : []),
    externalIPs,
    loadBalancer: {
      ingress: loadBalancerIngress,
    },
    ports,
    targetPort: primaryPort?.targetPort ?? null,
    nodePort: primaryPort?.nodePort ?? null,
    protocol: primaryPort?.protocol ?? null,
    selectors: service.spec?.selector || {},
    selector: service.spec?.selector || {},
    sessionAffinity: service.spec?.sessionAffinity || 'None',
    externalTrafficPolicy: service.spec?.externalTrafficPolicy || null,
    internalTrafficPolicy: service.spec?.internalTrafficPolicy || null,
    labels: service.metadata.labels || {},
    annotations: service.metadata.annotations || {},
    endpoints,
    status: service.status || {},
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

async function listServices(namespace, clients) {
  const { coreV1Api } = clients;

  const response = namespace
    ? await coreV1Api.listNamespacedService({ namespace })
    : await coreV1Api.listServiceForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapService);
}

async function getServiceDetails(namespace, name, { includeRelated = false, includeEvents = false } = {}, clients) {
  const { coreV1Api } = clients;

  const response = await coreV1Api.readNamespacedService({ name, namespace });
  const service = getResponseBody(response);

  let endpoints = null;
  try {
    const epResponse = await coreV1Api.readNamespacedEndpoints({ name, namespace });
    const ep = getResponseBody(epResponse);
    endpoints = {
      subsets: (ep.subsets || []).map((s) => ({
        addresses: (s.addresses || []).map((a) => ({
          ip: a.ip,
          nodeName: a.nodeName || null,
          targetRef: a.targetRef ? { kind: a.targetRef.kind, name: a.targetRef.name } : null,
        })),
        notReadyAddresses: (s.notReadyAddresses || []).map((a) => ({
          ip: a.ip,
          nodeName: a.nodeName || null,
        })),
        ports: (s.ports || []).map((p) => ({
          name: p.name || null,
          port: p.port,
          protocol: p.protocol,
        })),
      })),
    };
  } catch (_e) {
    endpoints = null;
  }

  let relatedPods;
  if (includeRelated) {
    const selector = service.spec?.selector || {};
    const entries = Object.entries(selector);
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
    events = await getResourceEvents({ kind: 'Service', namespace, name, uid: service.metadata?.uid }, clients);
  }

  return mapServiceDetails(service, endpoints, { relatedPods, events });
}

module.exports = {
  listServices,
  getServiceDetails,
};

