const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody } = require('../../utils/k8sHelpers');

function mapIngress(ingress) {
  const rules = ingress.spec?.rules || [];
  const hosts = [];
  const paths = [];
  const backendServices = [];

  for (const rule of rules) {
    if (rule.host) {
      hosts.push(rule.host);
    }

    for (const httpPath of rule.http?.paths || []) {
      paths.push({
        host: rule.host || '*',
        path: httpPath.path,
        pathType: httpPath.pathType,
      });

      const serviceName =
        httpPath.backend?.service?.name ||
        httpPath.backend?.resource?.name ||
        null;
      const servicePort =
        httpPath.backend?.service?.port?.number ||
        httpPath.backend?.service?.port?.name ||
        null;

      if (serviceName) {
        backendServices.push({
          host: rule.host || '*',
          path: httpPath.path,
          serviceName,
          servicePort,
        });
      }
    }
  }

  return {
    name: ingress.metadata.name,
    namespace: ingress.metadata.namespace,
    hosts,
    paths,
    backendServices,
    ingressClass:
      ingress.spec?.ingressClassName ||
      ingress.metadata.annotations?.['kubernetes.io/ingress.class'] ||
      null,
    addresses: (ingress.status?.loadBalancer?.ingress || []).map((ing) => ({
      ip: ing.ip,
      hostname: ing.hostname,
    })),
    creationTimestamp: ingress.metadata.creationTimestamp,
  };
}

async function listIngresses(namespace) {
  const { networkingV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await networkingV1Api.listNamespacedIngress({ namespace })
    : await networkingV1Api.listIngressForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapIngress);
}

module.exports = {
  listIngresses,
};
