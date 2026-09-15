const { getResponseBody } = require('../../utils/k8sHelpers');

const crdCacheMap = new Map();
const CRD_CACHE_TTL_MS = 60000;

function sanitizeKongConfig(config) {
  if (!config || typeof config !== 'object') {
    return config;
  }

  if (Array.isArray(config)) {
    return config.map((item) => sanitizeKongConfig(item));
  }

  const sensitivePattern = /pass(word)?|secret|token|api_?key|private_?key|cert(ificate)?|auth|credential/i;
  const sanitized = {};

  for (const [key, value] of Object.entries(config)) {
    if (sensitivePattern.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeKongConfig(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function extractKongAnnotations(annotations = {}) {
  const kongAnnotations = {};
  for (const [key, value] of Object.entries(annotations)) {
    if (key.startsWith('konghq.com/')) {
      kongAnnotations[key] = value;
    }
  }

  const pluginsRaw = kongAnnotations['konghq.com/plugins'];
  const pluginNames = pluginsRaw
    ? pluginsRaw.split(',').map((p) => p.trim()).filter(Boolean)
    : [];

  const stripPathRaw = kongAnnotations['konghq.com/strip-path'];
  const preserveHostRaw = kongAnnotations['konghq.com/preserve-host'];
  const protocolsRaw = kongAnnotations['konghq.com/protocols'];
  const methodsRaw = kongAnnotations['konghq.com/methods'];
  const snisRaw = kongAnnotations['konghq.com/snis'];
  const hostAliasesRaw = kongAnnotations['konghq.com/host-aliases'];

  return {
    raw: kongAnnotations,
    hasKongAnnotations: Object.keys(kongAnnotations).length > 0,
    plugins: pluginNames,
    stripPath: stripPathRaw !== undefined ? stripPathRaw === 'true' : null,
    preserveHost: preserveHostRaw !== undefined ? preserveHostRaw === 'true' : null,
    protocols: protocolsRaw ? protocolsRaw.split(',').map((p) => p.trim()).filter(Boolean) : null,
    methods: methodsRaw ? methodsRaw.split(',').map((m) => m.trim().toUpperCase()).filter(Boolean) : null,
    headers: kongAnnotations['konghq.com/headers'] || null,
    regexPriority: kongAnnotations['konghq.com/regex-priority']
      ? parseInt(kongAnnotations['konghq.com/regex-priority'], 10)
      : null,
    httpsRedirectStatusCode: kongAnnotations['konghq.com/https-redirect-status-code']
      ? parseInt(kongAnnotations['konghq.com/https-redirect-status-code'], 10)
      : null,
    snis: snisRaw ? snisRaw.split(',').map((s) => s.trim()).filter(Boolean) : null,
    hostAliases: hostAliasesRaw ? hostAliasesRaw.split(',').map((h) => h.trim()).filter(Boolean) : null,
  };
}

async function getIngressClassControllerMap(clients) {
  try {
    const { networkingV1Api } = clients;
    const res = await networkingV1Api.listIngressClass();
    const items = getResponseBody(res).items || [];
    const map = {};
    for (const ic of items) {
      if (ic.metadata?.name) {
        map[ic.metadata.name] = ic.spec?.controller || null;
      }
    }
    return map;
  } catch (_err) {
    return {};
  }
}

function detectController({ ingressClassName, annotations = {}, parentRefs = [] }, ingressClassMap = {}) {
  const effectiveClass =
    ingressClassName ||
    annotations['kubernetes.io/ingress.class'] ||
    null;

  const controllerName = effectiveClass ? ingressClassMap[effectiveClass] : null;

  const hasKongAnnotation = Object.keys(annotations).some((k) => k.startsWith('konghq.com/'));
  const classMatchesKong = Boolean(effectiveClass && effectiveClass.toLowerCase().includes('kong'));
  const controllerMatchesKong = Boolean(controllerName && controllerName.toLowerCase().includes('kong'));
  const parentRefMatchesKong = parentRefs.some(
    (p) => (p.name && p.name.toLowerCase().includes('kong')) || (p.namespace && p.namespace.toLowerCase().includes('kong'))
  );

  const isKong = hasKongAnnotation || classMatchesKong || controllerMatchesKong || parentRefMatchesKong;

  if (isKong) {
    return {
      type: 'kong',
      detected: true,
      className: effectiveClass || 'kong',
      controllerName: controllerName || 'ingress-controllers.konghq.com/kong',
    };
  }

  return {
    type: controllerName ? 'other' : 'unknown',
    detected: false,
    className: effectiveClass,
    controllerName: controllerName || null,
  };
}

async function detectKongCRDs(clients, clusterId = 'default', forceRefresh = false) {
  const now = Date.now();
  const cached = crdCacheMap.get(clusterId);
  if (!forceRefresh && cached && now - cached.time < CRD_CACHE_TTL_MS) {
    return cached.data;
  }

  const { customObjectsApi } = clients;
  const checks = [
    { key: 'kongPlugins', group: 'configuration.konghq.com', version: 'v1', plural: 'kongplugins' },
    { key: 'kongClusterPlugins', group: 'configuration.konghq.com', version: 'v1', plural: 'kongclusterplugins' },
    { key: 'kongConsumers', group: 'configuration.konghq.com', version: 'v1', plural: 'kongconsumers' },
    { key: 'kongIngresses', group: 'configuration.konghq.com', version: 'v1', plural: 'kongingresses' },
    { key: 'gateways', group: 'gateway.networking.k8s.io', version: 'v1', plural: 'gateways' },
    { key: 'gatewayClasses', group: 'gateway.networking.k8s.io', version: 'v1', plural: 'gatewayclasses' },
    { key: 'httpRoutes', group: 'gateway.networking.k8s.io', version: 'v1', plural: 'httproutes' },
    { key: 'referenceGrants', group: 'gateway.networking.k8s.io', version: 'v1beta1', plural: 'referencegrants' },
  ];

  const results = {};
  await Promise.all(
    checks.map(async (check) => {
      try {
        await customObjectsApi.listClusterCustomObject({
          group: check.group,
          version: check.version,
          plural: check.plural,
        });
        results[check.key] = true;
      } catch (err) {
        results[check.key] = false;
      }
    })
  );

  crdCacheMap.set(clusterId, { data: results, time: now });
  return results;
}

async function resolveKongPlugins(namespace, pluginNames = [], clients) {
  if (!pluginNames || pluginNames.length === 0) {
    return [];
  }

  const { customObjectsApi } = clients;
  const resolved = await Promise.all(
    pluginNames.map(async (name) => {
      try {
        const res = await customObjectsApi.getNamespacedCustomObject({
          group: 'configuration.konghq.com',
          version: 'v1',
          namespace,
          plural: 'kongplugins',
          name,
        });
        const pluginObj = getResponseBody(res);
        return {
          name,
          namespace,
          kind: 'KongPlugin',
          plugin: pluginObj.plugin || pluginObj.metadata?.name || 'unknown',
          config: sanitizeKongConfig(pluginObj.config || {}),
          enabled: pluginObj.enabled !== false,
          resolved: true,
        };
      } catch (err) {
        if (err.code === 404 || err.statusCode === 404) {
          try {
            const clusterRes = await customObjectsApi.getClusterCustomObject({
              group: 'configuration.konghq.com',
              version: 'v1',
              plural: 'kongclusterplugins',
              name,
            });
            const clusterObj = getResponseBody(clusterRes);
            return {
              name,
              kind: 'KongClusterPlugin',
              plugin: clusterObj.plugin || clusterObj.metadata?.name || 'unknown',
              config: sanitizeKongConfig(clusterObj.config || {}),
              enabled: clusterObj.enabled !== false,
              resolved: true,
            };
          } catch (_clusterErr) {
            return {
              name,
              namespace,
              kind: 'KongPlugin',
              resolved: false,
              error: 'KongPlugin not found in namespace or cluster',
            };
          }
        }
        return {
          name,
          namespace,
          kind: 'KongPlugin',
          resolved: false,
          error: err.message || 'Error resolving KongPlugin',
        };
      }
    })
  );

  return resolved;
}

async function resolveServiceBackendPods(namespace, serviceName, clients) {
  if (!serviceName || !namespace) return [];
  try {
    const { coreV1Api } = clients;
    const epRes = await coreV1Api.readNamespacedEndpoints({ name: serviceName, namespace });
    const ep = getResponseBody(epRes);
    const subsets = ep.subsets || [];
    const pods = [];

    for (const subset of subsets) {
      for (const addr of subset.addresses || []) {
        pods.push({
          podName: addr.targetRef?.name || null,
          ip: addr.ip || null,
          nodeName: addr.nodeName || null,
          ready: true,
        });
      }
      for (const addr of subset.notReadyAddresses || []) {
        pods.push({
          podName: addr.targetRef?.name || null,
          ip: addr.ip || null,
          nodeName: addr.nodeName || null,
          ready: false,
        });
      }
    }
    return pods;
  } catch (_err) {
    return [];
  }
}

async function buildRoutingGraph({
  resourceType,
  name,
  namespace,
  hosts = [],
  paths = [],
  backendServices = [],
  controller,
  plugins = [],
  parentRefs = [],
  resolvePods = false,
}, clients) {
  const backends = await Promise.all(
    backendServices.map(async (backend) => {
      const svcNamespace = backend.namespace || namespace;
      const svcName = backend.serviceName || backend.name;
      let targetPods = [];
      if (resolvePods && svcName && clients) {
        targetPods = await resolveServiceBackendPods(svcNamespace, svcName, clients);
      }
      return {
        serviceName: svcName,
        namespace: svcNamespace,
        port: backend.servicePort ?? backend.port ?? null,
        weight: backend.weight ?? 1,
        pods: targetPods,
        totalPods: targetPods.length,
        readyPods: targetPods.filter((p) => p.ready).length,
      };
    })
  );

  return {
    gateway: {
      type: controller?.type || 'kong',
      detected: Boolean(controller?.detected),
      controllerName: controller?.controllerName || 'ingress-controllers.konghq.com/kong',
      className: controller?.className || 'kong',
      parentRefs: parentRefs.map((p) => ({
        name: p.name,
        namespace: p.namespace || namespace,
      })),
    },
    entry: {
      resourceType,
      name,
      namespace,
      hosts,
      paths: paths.map((p) => (typeof p === 'string' ? p : p.path || '/')),
    },
    plugins: plugins.map((p) => ({
      name: p.name,
      kind: p.kind,
      plugin: p.plugin,
      resolved: p.resolved,
    })),
    backends,
  };
}

module.exports = {
  sanitizeKongConfig,
  extractKongAnnotations,
  getIngressClassControllerMap,
  detectController,
  detectKongCRDs,
  resolveKongPlugins,
  resolveServiceBackendPods,
  buildRoutingGraph,
};
