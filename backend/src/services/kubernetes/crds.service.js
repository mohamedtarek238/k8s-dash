const { getResponseBody, calculateAge } = require('../../utils/k8sHelpers');

const crdCacheMap = new Map();
const CRD_CACHE_TTL_MS = 60000;

// ---------------------------------------------------------------------------
// Operator Detection Heuristic (Safe - no fake names)
// ---------------------------------------------------------------------------

const WELL_KNOWN_OPERATORS = [
  { pattern: /monitoring\.coreos\.com$/, name: 'Prometheus Operator' },
  { pattern: /k8s\.keycloak\.org$/, name: 'Keycloak Operator' },
  { pattern: /(configuration|gateway-operator|konnect)\.konghq\.com$/, name: 'Kong Gateway' },
  { pattern: /platform\.confluent\.io$/, name: 'Confluent Operator' },
  { pattern: /metallb\.io$/, name: 'MetalLB' },
  { pattern: /infinispan\.org$/, name: 'Infinispan Operator' },
  { pattern: /aquasecurity\.github\.io$/, name: 'Trivy / Aqua Security' },
  { pattern: /operators\.coreos\.com$/, name: 'Operator Lifecycle Manager (OLM)' },
  { pattern: /gateway\.networking\.k8s\.io$/, name: 'Kubernetes Gateway API' },
  { pattern: /cert-manager\.io$/, name: 'cert-manager' },
  { pattern: /strimzi\.io$/, name: 'Strimzi Kafka Operator' },
  { pattern: /argoproj\.io$/, name: 'Argo Project' },
  { pattern: /rook\.io$/, name: 'Rook Ceph Operator' },
  { pattern: /istio\.io$/, name: 'Istio Service Mesh' },
  { pattern: /cilium\.io$/, name: 'Cilium' },
  { pattern: /knative\.dev$/, name: 'Knative' },
  { pattern: /keda\.sh$/, name: 'KEDA' },
  { pattern: /rabbitmq\.com$/, name: 'RabbitMQ Operator' },
  { pattern: /zalando\.org$/, name: 'Postgres Operator (Zalando)' },
  { pattern: /flagger\.app$/, name: 'Flagger' },
];

function detectOperator(crd) {
  const labels = crd.metadata?.labels || {};
  const annotations = crd.metadata?.annotations || {};
  const group = crd.spec?.group || '';

  // 1. Check explicit label/annotation signals from OLM or standard Kubernetes packaging
  const explicitName =
    labels['app.kubernetes.io/part-of'] ||
    labels['operators.coreos.com/operator-name'] ||
    labels['olm.owner'] ||
    annotations['operator.name'];

  if (explicitName && typeof explicitName === 'string' && explicitName.trim()) {
    return {
      name: explicitName.trim(),
      detected: true,
      source: 'label',
    };
  }

  // 2. Check well-known API group match
  for (const op of WELL_KNOWN_OPERATORS) {
    if (op.pattern.test(group)) {
      return {
        name: op.name,
        detected: true,
        source: 'apiGroup',
      };
    }
  }

  // 3. Fallback: undetected
  return {
    name: null,
    detected: false,
    source: null,
  };
}

// ---------------------------------------------------------------------------
// CRD Mapping Helpers
// ---------------------------------------------------------------------------

function findPreferredVersion(versions = []) {
  if (!versions.length) return 'v1';
  const storage = versions.find((v) => v.storage && v.served);
  if (storage) return storage.name;
  const served = versions.find((v) => v.served);
  if (served) return served.name;
  return versions[0].name;
}

function extractDescription(crd, preferredVersion) {
  try {
    const versions = crd.spec?.versions || [];
    const vObj = versions.find((v) => v.name === preferredVersion) || versions[0];
    const schema = vObj?.schema?.openAPIV3Schema;
    return schema?.description || null;
  } catch {
    return null;
  }
}

function isCRDEstablished(crd) {
  const conditions = crd.status?.conditions || [];
  const est = conditions.find((c) => c.type === 'Established');
  return est?.status === 'True';
}

function mapCRDSummary(crd) {
  const spec = crd.spec || {};
  const versions = (spec.versions || []).map((v) => ({
    name: v.name,
    served: Boolean(v.served),
    storage: Boolean(v.storage),
  }));
  const preferredVersion = findPreferredVersion(versions);
  const operator = detectOperator(crd);

  return {
    name: crd.metadata?.name || '',
    group: spec.group || '',
    version: preferredVersion,
    versions,
    kind: spec.names?.kind || '',
    plural: spec.names?.plural || '',
    singular: spec.names?.singular || '',
    scope: spec.scope || 'Namespaced',
    shortNames: spec.names?.shortNames || [],
    categories: spec.names?.categories || [],
    description: extractDescription(crd, preferredVersion),
    established: isCRDEstablished(crd),
    operator,
    creationTimestamp: crd.metadata?.creationTimestamp || null,
    age: calculateAge(crd.metadata?.creationTimestamp),
    labels: crd.metadata?.labels || {},
    annotations: crd.metadata?.annotations || {},
  };
}

function mapCRDDetails(crd) {
  const summary = mapCRDSummary(crd);
  const conditions = (crd.status?.conditions || []).map((c) => ({
    type: c.type,
    status: c.status,
    reason: c.reason || null,
    message: c.message || null,
    lastTransitionTime: c.lastTransitionTime || null,
  }));

  return {
    ...summary,
    storedVersions: crd.status?.storedVersions || [],
    conditions,
    spec: crd.spec,
    status: crd.status,
  };
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

async function listCRDs(clients, clusterId = 'default', forceRefresh = false) {
  const now = Date.now();
  const cached = crdCacheMap.get(clusterId);
  if (!forceRefresh && cached && now - cached.time < CRD_CACHE_TTL_MS) {
    return cached.data;
  }

  const { apiextensionsV1Api } = clients;
  if (!apiextensionsV1Api) {
    throw new Error('ApiextensionsV1Api is not initialized.');
  }

  const response = await apiextensionsV1Api.listCustomResourceDefinition();
  const items = getResponseBody(response).items || [];
  const crds = items.map(mapCRDSummary);

  // Sort alphabetically by group then kind
  crds.sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.kind.localeCompare(b.kind);
  });

  crdCacheMap.set(clusterId, { data: crds, time: now });
  return crds;
}

async function getCRDDetails(name, clients) {
  const { apiextensionsV1Api } = clients;
  const response = await apiextensionsV1Api.readCustomResourceDefinition({ name });
  const raw = getResponseBody(response);
  return mapCRDDetails(raw);
}

async function getCRDByGroupVersionPlural(group, version, plural, clients) {
  const { apiextensionsV1Api } = clients;
  const crdName = `${plural}.${group}`;
  try {
    const response = await apiextensionsV1Api.readCustomResourceDefinition({ name: crdName });
    const raw = getResponseBody(response);
    return mapCRDDetails(raw);
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) {
      // Fallback search in all CRDs
      const response = await apiextensionsV1Api.listCustomResourceDefinition();
      const items = getResponseBody(response).items || [];
      const match = items.find(
        (c) => c.spec?.group === group && c.spec?.names?.plural === plural
      );
      if (match) {
        return mapCRDDetails(match);
      }
    }
    throw err;
  }
}

async function getOperatorsSummary(clients, clusterId = 'default') {
  const crds = await listCRDs(clients, clusterId);

  const groupMap = new Map();

  for (const crd of crds) {
    const groupKey = crd.operator?.detected ? crd.operator.name : crd.group;
    const isDetected = Boolean(crd.operator?.detected);

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        name: groupKey,
        detected: isDetected,
        group: crd.group,
        crds: [],
        totalCRDs: 0,
      });
    }

    const entry = groupMap.get(groupKey);
    entry.crds.push({
      name: crd.name,
      kind: crd.kind,
      group: crd.group,
      version: crd.version,
      scope: crd.scope,
    });
    entry.totalCRDs = entry.crds.length;
  }

  return Array.from(groupMap.values()).sort((a, b) => b.totalCRDs - a.totalCRDs);
}

function mapCustomResourceSummary(item, kind) {
  return {
    name: item.metadata?.name || 'unknown',
    namespace: item.metadata?.namespace || null,
    kind: item.kind || kind || 'CustomResource',
    apiVersion: item.apiVersion || '',
    creationTimestamp: item.metadata?.creationTimestamp || null,
    age: calculateAge(item.metadata?.creationTimestamp),
    labels: item.metadata?.labels || {},
    annotations: item.metadata?.annotations || {},
    generation: item.metadata?.generation || null,
    statusSummary: item.status?.phase || item.status?.state || (item.status?.conditions ? 'Conditions' : null),
  };
}

async function listCustomResources({ group, version, plural, scope, namespace }, clients) {
  const { customObjectsApi } = clients;
  if (!customObjectsApi) {
    throw new Error('CustomObjectsApi is not initialized.');
  }

  let response;
  const isNamespaced = scope ? scope.toLowerCase() === 'namespaced' : Boolean(namespace);

  try {
    if (isNamespaced && namespace) {
      response = await customObjectsApi.listNamespacedCustomObject({
        group,
        version,
        namespace,
        plural,
      });
    } else {
      response = await customObjectsApi.listClusterCustomObject({
        group,
        version,
        plural,
      });
    }

    const raw = getResponseBody(response);
    const items = raw.items || [];
    return items.map((item) => mapCustomResourceSummary(item, raw.kind?.replace(/List$/, '')));
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) {
      return [];
    }
    throw err;
  }
}

async function getCustomResourceDetails({ group, version, plural, scope, namespace, name }, clients) {
  const { customObjectsApi } = clients;
  if (!customObjectsApi) {
    throw new Error('CustomObjectsApi is not initialized.');
  }

  let response;
  const isNamespaced = scope ? scope.toLowerCase() === 'namespaced' : Boolean(namespace);

  if (isNamespaced && namespace) {
    response = await customObjectsApi.getNamespacedCustomObject({
      group,
      version,
      namespace,
      plural,
      name,
    });
  } else {
    response = await customObjectsApi.getClusterCustomObject({
      group,
      version,
      plural,
      name,
    });
  }

  const item = getResponseBody(response);
  return {
    metadata: item.metadata || {},
    spec: item.spec || {},
    status: item.status || {},
    kind: item.kind || 'CustomResource',
    apiVersion: item.apiVersion || `${group}/${version}`,
    raw: item,
  };
}

module.exports = {
  detectOperator,
  listCRDs,
  getCRDDetails,
  getCRDByGroupVersionPlural,
  getOperatorsSummary,
  listCustomResources,
  getCustomResourceDetails,
};
