const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody } = require('../../utils/k8sHelpers');

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

async function listServices(namespace) {
  const { coreV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await coreV1Api.listNamespacedService({ namespace })
    : await coreV1Api.listServiceForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapService);
}

module.exports = {
  listServices,
};
