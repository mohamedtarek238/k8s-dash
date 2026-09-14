const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody, calculateAge } = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');
const {
  extractKongAnnotations,
  detectController,
  resolveKongPlugins,
  buildRoutingGraph,
  getIngressClassControllerMap,
} = require('./kong.service');

function mapIngress(ingress, ingressClassMap = {}) {
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
        path: httpPath.path || '/',
        pathType: httpPath.pathType || 'ImplementationSpecific',
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
          path: httpPath.path || '/',
          serviceName,
          servicePort,
        });
      }
    }
  }

  const annotations = ingress.metadata?.annotations || {};
  const ingressClassName =
    ingress.spec?.ingressClassName ||
    annotations['kubernetes.io/ingress.class'] ||
    null;

  const controller = detectController({ ingressClassName, annotations }, ingressClassMap);
  const kongAnnotations = extractKongAnnotations(annotations);

  const addresses = (ingress.status?.loadBalancer?.ingress || []).map((ing) => ({
    ip: ing.ip || null,
    hostname: ing.hostname || null,
  }));

  return {
    name: ingress.metadata.name,
    namespace: ingress.metadata.namespace,
    hosts,
    paths,
    backendServices,
    ingressClass: ingressClassName,
    ingressClassName,
    controller,
    kong: {
      hasKongAnnotations: kongAnnotations.hasKongAnnotations,
      plugins: kongAnnotations.plugins,
      annotations: kongAnnotations.raw,
      stripPath: kongAnnotations.stripPath,
      preserveHost: kongAnnotations.preserveHost,
      protocols: kongAnnotations.protocols,
      methods: kongAnnotations.methods,
    },
    addresses,
    loadBalancerAddresses: addresses,
    creationTimestamp: ingress.metadata.creationTimestamp,
    age: calculateAge(ingress.metadata.creationTimestamp),
  };
}

function mapIngressDetails(ingress, { relatedServices, events, resolvedPlugins = [], routing = null, ingressClassMap = {} } = {}) {
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

  const annotations = ingress.metadata?.annotations || {};
  const ingressClassName =
    ingress.spec?.ingressClassName ||
    annotations['kubernetes.io/ingress.class'] ||
    null;

  const controller = detectController({ ingressClassName, annotations }, ingressClassMap);
  const kongAnnotations = extractKongAnnotations(annotations);

  const data = {
    name: ingress.metadata.name,
    namespace: ingress.metadata.namespace,
    uid: ingress.metadata.uid,
    resourceVersion: ingress.metadata.resourceVersion,
    creationTimestamp: ingress.metadata.creationTimestamp,
    age: calculateAge(ingress.metadata.creationTimestamp),
    ingressClass: ingressClassName,
    ingressClassName,
    controller,
    hosts,
    paths,
    pathType: paths[0]?.pathType || null,
    backendServiceNames,
    backendServicePorts,
    backendServices,
    tls,
    loadBalancerAddresses,
    addresses: loadBalancerAddresses,
    rules,
    defaultBackend,
    labels: ingress.metadata.labels || {},
    annotations,
    kong: {
      hasKongAnnotations: kongAnnotations.hasKongAnnotations,
      plugins: kongAnnotations.plugins,
      resolvedPlugins,
      annotations: kongAnnotations.raw,
      stripPath: kongAnnotations.stripPath,
      preserveHost: kongAnnotations.preserveHost,
      protocols: kongAnnotations.protocols,
      methods: kongAnnotations.methods,
      headers: kongAnnotations.headers,
      regexPriority: kongAnnotations.regexPriority,
      httpsRedirectStatusCode: kongAnnotations.httpsRedirectStatusCode,
      snis: kongAnnotations.snis,
      hostAliases: kongAnnotations.hostAliases,
    },
    routing,
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

async function listIngresses(namespace, { includeKong = false } = {}) {
  const { networkingV1Api } = initializeKubernetesClients();
  const ingressClassMap = await getIngressClassControllerMap();

  const response = namespace
    ? await networkingV1Api.listNamespacedIngress({ namespace })
    : await networkingV1Api.listIngressForAllNamespaces();

  const items = getResponseBody(response).items || [];
  return items.map((ing) => mapIngress(ing, ingressClassMap));
}

async function getIngressDetails(namespace, name, { includeRelated = false, includeEvents = false, includeKong = true } = {}) {
  const { networkingV1Api, coreV1Api } = initializeKubernetesClients();
  const ingressClassMap = await getIngressClassControllerMap();

  const response = await networkingV1Api.readNamespacedIngress({ name, namespace });
  const ingress = getResponseBody(response);

  const annotations = ingress.metadata?.annotations || {};
  const kongAnnotations = extractKongAnnotations(annotations);

  let resolvedPlugins = [];
  if (includeKong && kongAnnotations.plugins.length > 0) {
    resolvedPlugins = await resolveKongPlugins(namespace, kongAnnotations.plugins);
  }

  const ingressClassName =
    ingress.spec?.ingressClassName ||
    annotations['kubernetes.io/ingress.class'] ||
    null;
  const controller = detectController({ ingressClassName, annotations }, ingressClassMap);

  const rules = ingress.spec?.rules || [];
  const backendServices = [];
  const hosts = [];
  const paths = [];

  for (const rule of rules) {
    if (rule.host && !hosts.includes(rule.host)) hosts.push(rule.host);
    for (const p of rule.http?.paths || []) {
      paths.push(p.path || '/');
      const sName = p.backend?.service?.name || p.backend?.resource?.name;
      const sPort = p.backend?.service?.port?.number ?? p.backend?.service?.port?.name ?? null;
      if (sName) {
        backendServices.push({
          serviceName: sName,
          servicePort: sPort,
          namespace,
        });
      }
    }
  }

  const routing = await buildRoutingGraph({
    resourceType: 'Ingress',
    name,
    namespace,
    hosts,
    paths,
    backendServices,
    controller,
    plugins: resolvedPlugins,
    resolvePods: true,
  });

  let relatedServices;
  if (includeRelated) {
    const serviceNames = new Set(backendServices.map((b) => b.serviceName));
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

  return mapIngressDetails(ingress, {
    relatedServices,
    events,
    resolvedPlugins,
    routing,
    ingressClassMap,
  });
}

module.exports = {
  listIngresses,
  getIngressDetails,
};
