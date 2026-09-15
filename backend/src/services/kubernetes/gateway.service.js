const { getResponseBody, calculateAge } = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');
const {
  extractKongAnnotations,
  detectController,
  resolveKongPlugins,
  buildRoutingGraph,
  getIngressClassControllerMap,
} = require('./kong.service');

const GROUP = 'gateway.networking.k8s.io';
const VERSION = 'v1';
const VERSION_BETA = 'v1beta1';

function mapGateway(gw) {
  const listeners = (gw.spec?.listeners || []).map((l) => ({
    name: l.name,
    port: l.port,
    protocol: l.protocol,
    hostname: l.hostname || '*',
    allowedRoutes: l.allowedRoutes || {},
  }));

  const addresses = (gw.status?.addresses || []).map((a) => ({
    type: a.type || 'IPAddress',
    value: a.value,
  }));

  const controller = detectController({
    annotations: gw.metadata?.annotations || {},
    parentRefs: [{ name: gw.spec?.gatewayClassName }],
  });

  return {
    name: gw.metadata.name,
    namespace: gw.metadata.namespace,
    gatewayClassName: gw.spec?.gatewayClassName || null,
    listeners,
    addresses,
    conditions: gw.status?.conditions || [],
    controller,
    labels: gw.metadata.labels || {},
    annotations: gw.metadata.annotations || {},
    creationTimestamp: gw.metadata.creationTimestamp,
    age: calculateAge(gw.metadata.creationTimestamp),
  };
}

function mapGatewayClass(gc) {
  return {
    name: gc.metadata.name,
    controllerName: gc.spec?.controllerName || null,
    description: gc.spec?.description || null,
    parametersRef: gc.spec?.parametersRef || null,
    conditions: gc.status?.conditions || [],
    labels: gc.metadata.labels || {},
    annotations: gc.metadata.annotations || {},
    creationTimestamp: gc.metadata.creationTimestamp,
    age: calculateAge(gc.metadata.creationTimestamp),
  };
}

function mapHttpRouteBasic(hr, ingressClassMap = {}) {
  const hostnames = hr.spec?.hostnames || [];
  const parentRefs = hr.spec?.parentRefs || [];
  const rules = hr.spec?.rules || [];
  const paths = [];
  const backendServices = [];

  for (const rule of rules) {
    for (const match of rule.matches || []) {
      if (match.path) {
        paths.push({
          type: match.path.type || 'PathPrefix',
          value: match.path.value || '/',
        });
      }
    }

    for (const backend of rule.backendRefs || []) {
      const sName = backend.name;
      const sNs = backend.namespace || hr.metadata.namespace;
      const sPort = backend.port;
      const sWeight = backend.weight ?? 1;
      backendServices.push({
        serviceName: sName,
        namespace: sNs,
        servicePort: sPort,
        weight: sWeight,
      });
    }
  }

  const annotations = hr.metadata?.annotations || {};
  const kongAnnotations = extractKongAnnotations(annotations);
  const controller = detectController({ annotations, parentRefs }, ingressClassMap);

  return {
    name: hr.metadata.name,
    namespace: hr.metadata.namespace,
    hostnames,
    parentRefs,
    rulesCount: rules.length,
    paths: paths.length > 0 ? paths : [{ type: 'PathPrefix', value: '/' }],
    backendServices,
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
    creationTimestamp: hr.metadata.creationTimestamp,
    age: calculateAge(hr.metadata.creationTimestamp),
  };
}

async function listGateways(namespace, clients) {
  const { customObjectsApi } = clients;
  try {
    const res = namespace
      ? await customObjectsApi.listNamespacedCustomObject({
          group: GROUP,
          version: VERSION,
          namespace,
          plural: 'gateways',
        })
      : await customObjectsApi.listClusterCustomObject({
          group: GROUP,
          version: VERSION,
          plural: 'gateways',
        });
    const items = getResponseBody(res).items || [];
    return items.map(mapGateway);
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) {
      return [];
    }
    throw err;
  }
}

async function getGatewayDetails(namespace, name, clients) {
  const { customObjectsApi } = clients;
  const res = await customObjectsApi.getNamespacedCustomObject({
    group: GROUP,
    version: VERSION,
    namespace,
    plural: 'gateways',
    name,
  });
  const gw = getResponseBody(res);
  const data = mapGateway(gw);

  try {
    data.events = await getResourceEvents({
      kind: 'Gateway',
      namespace,
      name,
      uid: gw.metadata?.uid,
    }, clients);
  } catch (_e) {
    data.events = [];
  }

  return data;
}

async function listGatewayClasses(clients) {
  const { customObjectsApi } = clients;
  try {
    const res = await customObjectsApi.listClusterCustomObject({
      group: GROUP,
      version: VERSION,
      plural: 'gatewayclasses',
    });
    const items = getResponseBody(res).items || [];
    return items.map(mapGatewayClass);
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) {
      return [];
    }
    throw err;
  }
}

async function getGatewayClassDetails(name, clients) {
  const { customObjectsApi } = clients;
  const res = await customObjectsApi.getClusterCustomObject({
    group: GROUP,
    version: VERSION,
    plural: 'gatewayclasses',
    name,
  });
  const gc = getResponseBody(res);
  return mapGatewayClass(gc);
}

async function listHttpRoutes(namespace, clients) {
  const { customObjectsApi } = clients;
  const ingressClassMap = await getIngressClassControllerMap(clients);

  try {
    const res = namespace
      ? await customObjectsApi.listNamespacedCustomObject({
          group: GROUP,
          version: VERSION,
          namespace,
          plural: 'httproutes',
        })
      : await customObjectsApi.listClusterCustomObject({
          group: GROUP,
          version: VERSION,
          plural: 'httproutes',
        });
    const items = getResponseBody(res).items || [];
    return items.map((hr) => mapHttpRouteBasic(hr, ingressClassMap));
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) {
      return [];
    }
    throw err;
  }
}

async function getHttpRouteDetails(namespace, name, { resolvePods = true, includeEvents = true } = {}, clients) {
  const { customObjectsApi } = clients;
  const ingressClassMap = await getIngressClassControllerMap(clients);

  const res = await customObjectsApi.getNamespacedCustomObject({
    group: GROUP,
    version: VERSION,
    namespace,
    plural: 'httproutes',
    name,
  });
  const hr = getResponseBody(res);
  const basic = mapHttpRouteBasic(hr, ingressClassMap);

  let resolvedPlugins = [];
  if (basic.kong?.plugins && basic.kong.plugins.length > 0) {
    resolvedPlugins = await resolveKongPlugins(namespace, basic.kong.plugins, clients);
  }

  const routing = await buildRoutingGraph({
    resourceType: 'HTTPRoute',
    name,
    namespace,
    hosts: basic.hostnames,
    paths: basic.paths,
    backendServices: basic.backendServices,
    controller: basic.controller,
    plugins: resolvedPlugins,
    parentRefs: basic.parentRefs,
    resolvePods,
  }, clients);

  let events = [];
  if (includeEvents) {
    try {
      events = await getResourceEvents({
        kind: 'HTTPRoute',
        namespace,
        name,
        uid: hr.metadata?.uid,
      }, clients);
    } catch (_e) {
      events = [];
    }
  }

  return {
    ...basic,
    rules: hr.spec?.rules || [],
    rawAnnotations: hr.metadata?.annotations || {},
    rawLabels: hr.metadata?.labels || {},
    status: hr.status || {},
    kong: {
      ...basic.kong,
      resolvedPlugins,
    },
    routing,
    events,
  };
}

async function listReferenceGrants(namespace, clients) {
  const { customObjectsApi } = clients;
  try {
    const res = namespace
      ? await customObjectsApi.listNamespacedCustomObject({
          group: GROUP,
          version: VERSION_BETA,
          namespace,
          plural: 'referencegrants',
        })
      : await customObjectsApi.listClusterCustomObject({
          group: GROUP,
          version: VERSION_BETA,
          plural: 'referencegrants',
        });
    const items = getResponseBody(res).items || [];
    return items.map((rg) => ({
      name: rg.metadata.name,
      namespace: rg.metadata.namespace,
      from: rg.spec?.from || [],
      to: rg.spec?.to || [],
      creationTimestamp: rg.metadata.creationTimestamp,
      age: calculateAge(rg.metadata.creationTimestamp),
    }));
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) {
      return [];
    }
    throw err;
  }
}

module.exports = {
  listGateways,
  getGatewayDetails,
  listGatewayClasses,
  getGatewayClassDetails,
  listHttpRoutes,
  getHttpRouteDetails,
  listReferenceGrants,
};
