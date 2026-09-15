const fs = require('fs');
const os = require('os');
const path = require('path');
const k8s = require('@kubernetes/client-node');

// ---------------------------------------------------------------------------
// Cluster Registry
// ---------------------------------------------------------------------------
// Each entry: { id, name, context, server, kubeConfig, clients: null | {...} }
const clusterRegistry = new Map();
let defaultClusterId = null;
let registryInitialized = false;

// Legacy singleton references (backward compat)
let legacyKubeConfig;
let legacyCoreV1Api;
let legacyAppsV1Api;
let legacyBatchV1Api;
let legacyNetworkingV1Api;
let legacyCustomObjectsApi;
let legacyVersionApi;
let legacyInitialized = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63) || 'cluster';
}

function uniqueSlug(base, existing) {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/**
 * Splits an environment variable containing one or more kubeconfig paths.
 * Supports comma (`,`) and semicolon (`;`) delimiters across OSes.
 */
function parseKubeconfigEnvPaths(envVal) {
  if (!envVal || typeof envVal !== 'string') return [];
  const rawParts = envVal
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const resolvedPaths = [];
  for (const p of rawParts) {
    if (p) {
      resolvedPaths.push(path.resolve(p));
    }
  }
  return resolvedPaths;
}

function resolveKubeconfigPath() {
  if (process.env.KUBECONFIG) {
    const paths = parseKubeconfigEnvPaths(process.env.KUBECONFIG);
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  if (process.env.KUBECONFIGS) {
    const paths = parseKubeconfigEnvPaths(process.env.KUBECONFIGS);
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }

  const defaultPath = path.join(os.homedir(), '.kube', 'config');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
}

function assertValidKubeConfig(config) {
  const context = config.getCurrentContext();
  const server = config.getCurrentCluster()?.server;

  if (context === 'loaded-context' && server === 'http://localhost:8080') {
    const kubeconfigPath = resolveKubeconfigPath();
    throw new Error(
      kubeconfigPath
        ? `Invalid kubeconfig at ${kubeconfigPath}. Ensure current-context points to your cluster.`
        : 'No kubeconfig found. Place your config at ~/.kube/config or set the KUBECONFIG/KUBECONFIGS environment variable.'
    );
  }

  if (!context || !server) {
    throw new Error('Kubeconfig is missing a valid current-context or cluster server URL.');
  }
}

function createClientsFromKubeConfig(kc) {
  return {
    kubeConfig: kc,
    coreV1Api: kc.makeApiClient(k8s.CoreV1Api),
    appsV1Api: kc.makeApiClient(k8s.AppsV1Api),
    batchV1Api: kc.makeApiClient(k8s.BatchV1Api),
    networkingV1Api: kc.makeApiClient(k8s.NetworkingV1Api),
    customObjectsApi: kc.makeApiClient(k8s.CustomObjectsApi),
    apiextensionsV1Api: kc.makeApiClient(k8s.ApiextensionsV1Api),
    versionApi: kc.makeApiClient(k8s.VersionApi),
  };
}

function resolveServerForContext(kc, contextName) {
  const ctxObj = kc.getContextObject(contextName);
  if (!ctxObj?.cluster) return null;
  const cluster = kc.clusters.find((c) => c.name === ctxObj.cluster);
  return cluster?.server || null;
}

// ---------------------------------------------------------------------------
// Multi-cluster initialization
// ---------------------------------------------------------------------------

function loadClusterFromKubeConfig(kc, contextName, usedIds, configPath = null) {
  // Clone the kubeconfig and set it to this context
  const cloneKc = new k8s.KubeConfig();
  cloneKc.loadFromString(kc.exportConfig());
  cloneKc.setCurrentContext(contextName);

  const server = resolveServerForContext(cloneKc, contextName);
  if (!server) {
    console.warn(`[ClusterRegistry] Skipping context "${contextName}" — no server URL found.`);
    return null;
  }

  const baseSlug = slugify(contextName);
  const id = uniqueSlug(baseSlug, usedIds);
  usedIds.add(id);

  let displayName = contextName;
  if (id !== baseSlug && configPath) {
    const parentDir = path.basename(path.dirname(configPath));
    const fileName = path.basename(configPath);
    const label = parentDir && parentDir !== '.' && !parentDir.startsWith('/') && !parentDir.includes(':')
      ? parentDir
      : fileName;
    displayName = `${contextName} (${label})`;
  }

  return {
    id,
    name: displayName,
    context: contextName,
    server,
    kubeConfig: cloneKc,
    clients: null, // lazily created
  };
}

function initializeClusterRegistry() {
  if (registryInitialized) return;

  const usedIds = new Set();
  const rawConfiguredPaths = [];

  // 1. Collect all paths from KUBECONFIGS and KUBECONFIG (both support comma/semicolon separation)
  if (process.env.KUBECONFIGS) {
    rawConfiguredPaths.push(...parseKubeconfigEnvPaths(process.env.KUBECONFIGS));
  }
  if (process.env.KUBECONFIG) {
    rawConfiguredPaths.push(...parseKubeconfigEnvPaths(process.env.KUBECONFIG));
  }

  // Deduplicate preserving order
  const uniqueConfiguredPaths = Array.from(new Set(rawConfiguredPaths));

  const existingPaths = [];
  if (uniqueConfiguredPaths.length > 0) {
    for (const p of uniqueConfiguredPaths) {
      if (fs.existsSync(p)) {
        existingPaths.push(p);
      } else {
        console.warn(`[ClusterRegistry] Kubeconfig not found, skipping: ${p}`);
      }
    }

    if (existingPaths.length === 0) {
      throw new Error(
        `Configured kubeconfig path(s) not found: ${uniqueConfiguredPaths.join(', ')}. Please check your KUBECONFIG or KUBECONFIGS environment variable.`
      );
    }
  } else {
    // 2. Default ~/.kube/config fallback
    const defaultPath = path.join(os.homedir(), '.kube', 'config');
    if (fs.existsSync(defaultPath)) {
      existingPaths.push(defaultPath);
    }
  }

  // 3. Load kubeconfig files
  if (existingPaths.length > 0) {
    for (const configPath of existingPaths) {
      try {
        const kc = new k8s.KubeConfig();
        kc.loadFromFile(configPath);

        const contextName = kc.getCurrentContext();
        if (!contextName) {
          console.warn(`[ClusterRegistry] No current-context in ${configPath}, skipping.`);
          continue;
        }

        const entry = loadClusterFromKubeConfig(kc, contextName, usedIds, configPath);
        if (entry) {
          clusterRegistry.set(entry.id, entry);
          console.log(`[ClusterRegistry] Loaded cluster "${entry.id}" (${entry.name}) from ${configPath} [${entry.server}]`);
        }
      } catch (err) {
        console.error(`[ClusterRegistry] Failed to load ${configPath}: ${err.message}`);
      }
    }
  } else {
    // 4. In-cluster fallback
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromCluster();
      const contextName = kc.getCurrentContext() || 'in-cluster';
      const entry = loadClusterFromKubeConfig(kc, contextName, usedIds);
      if (entry) {
        clusterRegistry.set(entry.id, entry);
      }
    } catch (_inClusterErr) {
      // In-cluster unavailable
    }
  }

  if (clusterRegistry.size === 0) {
    throw new Error(
      'No Kubernetes clusters could be loaded. Ensure ~/.kube/config exists or set KUBECONFIG/KUBECONFIGS to valid kubeconfig file path(s).'
    );
  }

  // Resolve default cluster
  const envDefault = process.env.DEFAULT_CLUSTER;
  if (envDefault && clusterRegistry.has(envDefault)) {
    defaultClusterId = envDefault;
  } else {
    defaultClusterId = clusterRegistry.keys().next().value;
    if (envDefault) {
      console.warn(
        `[ClusterRegistry] DEFAULT_CLUSTER="${envDefault}" not found. Using "${defaultClusterId}".`
      );
    }
  }

  registryInitialized = true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function getDefaultClusterId() {
  if (!registryInitialized) initializeClusterRegistry();
  return defaultClusterId;
}

function getClusterClients(clusterId) {
  if (!registryInitialized) initializeClusterRegistry();

  const id = clusterId || defaultClusterId;
  const entry = clusterRegistry.get(id);
  if (!entry) {
    const error = new Error(`Unknown cluster "${id}". Available: ${[...clusterRegistry.keys()].join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  // Lazily create clients
  if (!entry.clients) {
    entry.clients = createClientsFromKubeConfig(entry.kubeConfig);
  }

  return entry.clients;
}

function getClusterMeta(clusterId) {
  if (!registryInitialized) initializeClusterRegistry();

  const id = clusterId || defaultClusterId;
  const entry = clusterRegistry.get(id);
  if (!entry) return null;

  return {
    id: entry.id,
    name: entry.name,
    context: entry.context,
    server: entry.server,
  };
}

function listClusters() {
  if (!registryInitialized) initializeClusterRegistry();

  return [...clusterRegistry.values()].map((entry) => ({
    id: entry.id,
    name: entry.name,
    context: entry.context,
    server: entry.server,
    isDefault: entry.id === defaultClusterId,
  }));
}

// ---------------------------------------------------------------------------
// Backward-compatible legacy API
// ---------------------------------------------------------------------------

function initializeKubernetesClients() {
  if (legacyInitialized) {
    return {
      kubeConfig: legacyKubeConfig,
      coreV1Api: legacyCoreV1Api,
      appsV1Api: legacyAppsV1Api,
      batchV1Api: legacyBatchV1Api,
      networkingV1Api: legacyNetworkingV1Api,
      customObjectsApi: legacyCustomObjectsApi,
      versionApi: legacyVersionApi,
    };
  }

  // Ensure registry is initialized, then alias default cluster
  if (!registryInitialized) initializeClusterRegistry();

  const clients = getClusterClients(defaultClusterId);
  legacyKubeConfig = clients.kubeConfig;
  legacyCoreV1Api = clients.coreV1Api;
  legacyAppsV1Api = clients.appsV1Api;
  legacyBatchV1Api = clients.batchV1Api;
  legacyNetworkingV1Api = clients.networkingV1Api;
  legacyCustomObjectsApi = clients.customObjectsApi;
  legacyVersionApi = clients.versionApi;
  legacyInitialized = true;

  return {
    kubeConfig: legacyKubeConfig,
    coreV1Api: legacyCoreV1Api,
    appsV1Api: legacyAppsV1Api,
    batchV1Api: legacyBatchV1Api,
    networkingV1Api: legacyNetworkingV1Api,
    customObjectsApi: legacyCustomObjectsApi,
    versionApi: legacyVersionApi,
  };
}

function getCurrentContext() {
  const meta = getClusterMeta(defaultClusterId);
  return meta?.context || null;
}

function getCurrentCluster() {
  if (!registryInitialized) initializeClusterRegistry();
  const entry = clusterRegistry.get(defaultClusterId);
  if (!entry) return null;
  const kc = entry.kubeConfig;
  const contextObj = kc.getContextObject(entry.context);
  return contextObj?.cluster || null;
}

function getClusterServer() {
  const meta = getClusterMeta(defaultClusterId);
  return meta?.server || null;
}

module.exports = {
  // New multi-cluster API
  initializeClusterRegistry,
  getClusterClients,
  getClusterMeta,
  listClusters,
  getDefaultClusterId,
  // Legacy backward-compat API
  initializeKubernetesClients,
  getCurrentContext,
  getCurrentCluster,
  getClusterServer,
};
