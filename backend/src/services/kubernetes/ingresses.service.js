const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody, calculateAge } = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');

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

function mapIngressDetails(ingress, { relatedServices, events } = {}) {
  const rules = ingress.spec?.rules || [];
  const hosts = [];
  const paths = [];
  const backendServices = [];
  const backendServiceNames = [];
  const backendServicePorts = [];

  for (const rule of rules) {
    if (rule.host && !hosts.includes(rule.host)) {
      hosts.push(rule.host);
    }

    for (const httpPath of rule.http?.paths || []) {
      const serviceName =
        httpPath.backend?.service?.name ||
        httpPath.backend?.resource?.name ||
        null;
      const servicePort =
        httpPath.backend?.service?.port?.number ??
        httpPath.backend?.service?.port?.name ??
        null;

      paths.push({
        host: rule.host || '*',
        path: httpPath.path || '/',
        pathType: httpPath.pathType || 'ImplementationSpecific',
        serviceName,
        servicePort,
      });

      if (serviceName) {
        if (!backendServiceNames.includes(serviceName)) {
          backendServiceNames.push(serviceName);
        }
        if (servicePort !== null && !backendServicePorts.includes(servicePort)) {
          backendServicePorts.push(servicePort);
        }
        backendServices.push({
          host: rule.host || '*',
          path: httpPath.path || '/',
          serviceName,
          servicePort,
        });
      }
    }
  }

  const defaultBackend = ingress.spec?.defaultBackend
    ? {
        serviceName:
          ingress.spec.defaultBackend.service?.name ||
          ingress.spec.defaultBackend.resource?.name ||
          null,
        servicePort:
          ingress.spec.defaultBackend.service?.port?.number ??
          ingress.spec.defaultBackend.service?.port?.name ??
          null,
      }
    : null;

  if (defaultBackend?.serviceName && !backendServiceNames.includes(defaultBackend.serviceName)) {
    backendServiceNames.push(defaultBackend.serviceName);
  }

  const tls = (ingress.spec?.tls || []).map((t) => ({
    hosts: t.hosts || [],
    secretName: t.secretName || null,
  }));

  const loadBalancerAddresses = (ingress.status?.loadBalancer?.ingress || []).map((ing) => ({
    ip: ing.ip || null,
    hostname: ing.hostname || null,
  }));

  const data = {
    name: ingress.metadata.name,
    namespace: ingress.metadata.namespace,
    uid: ingress.metadata.uid,
    resourceVersion: ingress.metadata.resourceVersion,
    creationTimestamp: ingress.metadata.creationTimestamp,
    age: calculateAge(ingress.metadata.creationTimestamp),
    ingressClassName:
      ingress.spec?.ingressClassName ||
      ingress.metadata.annotations?.['kubernetes.io/ingress.class'] ||
      null,
    hosts,
    paths,
    pathType: paths[0]?.pathType || null,
    backendServiceNames,
    backendServicePorts,
    backendServices,
    tls,
    loadBalancerAddresses,
    rules,
    defaultBackend,
    labels: ingress.metadata.labels || {},
    annotations: ingress.metadata.annotations || {},
    status: ingress.status || {},
    conditions: ingress.status?.conditions || [],
  };

  if (relatedServices !== undefined) {
    data.related = {
      services: relatedServices,
      totalServices: relatedServices.length,
    };
  }

  if (events !== undefined) {
    data.events = events;
  }

  return data;
}

async function listIngresses(namespace) {
  const { networkingV1Api } = initializeKubernetesClients();

  const response = namespace
    ? await networkingV1Api.listNamespacedIngress({ namespace })
    : await networkingV1Api.listIngressForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapIngress);
}

async function getIngressDetails(namespace, name, { includeRelated = false, includeEvents = false } = {}) {
  const { networkingV1Api, coreV1Api } = initializeKubernetesClients();

  const response = await networkingV1Api.readNamespacedIngress({ name, namespace });
  const ingress = getResponseBody(response);

  let relatedServices;
  if (includeRelated) {
    const serviceNames = new Set();
    for (const rule of ingress.spec?.rules || []) {
      for (const httpPath of rule.http?.paths || []) {
        const sName = httpPath.backend?.service?.name || httpPath.backend?.resource?.name;
        if (sName) serviceNames.add(sName);
      }
    }
    if (ingress.spec?.defaultBackend?.service?.name) {
      serviceNames.add(ingress.spec.defaultBackend.service.name);
    }

    const fetchedServices = await Promise.all(
      Array.from(serviceNames).map(async (svcName) => {
        try {
          const sRes = await coreV1Api.readNamespacedService({ name: svcName, namespace });
          const s = getResponseBody(sRes);
          return {
            name: s.metadata.name,
            namespace: s.metadata.namespace,
            type: s.spec?.type || 'ClusterIP',
            clusterIP: s.spec?.clusterIP || null,
            ports: (s.spec?.ports || []).map((p) => ({
              port: p.port,
              targetPort: p.targetPort,
              protocol: p.protocol,
            })),
          };
        } catch (_err) {
          return { name: svcName, namespace, missing: true };
        }
      })
    );
    relatedServices = fetchedServices;
  }

  let events;
  if (includeEvents) {
    events = await getResourceEvents({ kind: 'Ingress', namespace, name, uid: ingress.metadata?.uid });
  }

  return mapIngressDetails(ingress, { relatedServices, events });
}

module.exports = {
  listIngresses,
  getIngressDetails,
};

