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

function resolveKubeconfigPath() {
  if (process.env.KUBECONFIG) {
    const configuredPath = process.env.KUBECONFIG.split(path.delimiter)[0];
    if (configuredPath && fs.existsSync(configuredPath)) {
      return configuredPath;
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
        : 'No kubeconfig found. Place your config at ~/.kube/config or set the KUBECONFIG environment variable.'
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

function loadClusterFromKubeConfig(kc, contextName, usedIds) {
  // Clone the kubeconfig and set it to this context
  const cloneKc = new k8s.KubeConfig();
  cloneKc.loadFromString(kc.exportConfig());
  cloneKc.setCurrentContext(contextName);

  const server = resolveServerForContext(cloneKc, contextName);
  if (!server) {
    console.warn(`[ClusterRegistry] Skipping context "${contextName}" — no server URL found.`);
    return null;
  }

  const id = uniqueSlug(slugify(contextName), usedIds);
  usedIds.add(id);

  return {
    id,
    name: contextName,
    context: contextName,
    server,
    kubeConfig: cloneKc,
    clients: null, // lazily created
  };
}

function initializeClusterRegistry() {
  if (registryInitialized) return;

  const kubeconfigPaths = [];
  const usedIds = new Set();

  // Check KUBECONFIGS env (comma-separated)
  if (process.env.KUBECONFIGS) {
    const raw = process.env.KUBECONFIGS;
    const paths = raw.split(',').map((p) => p.trim()).filter(Boolean);
    for (const p of paths) {
      const resolved = path.resolve(p);
      if (fs.existsSync(resolved)) {
        kubeconfigPaths.push(resolved);
      } else {
        console.warn(`[ClusterRegistry] Kubeconfig not found, skipping: ${resolved}`);
      }
    }
  }

  // Fallback: single KUBECONFIG or default
  if (kubeconfigPaths.length === 0) {
    const singlePath = resolveKubeconfigPath();
    if (singlePath) {
      kubeconfigPaths.push(singlePath);
    }
  }

  if (kubeconfigPaths.length === 0) {
    // Try in-cluster
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    assertValidKubeConfig(kc);
    const contextName = kc.getCurrentContext();
    const entry = loadClusterFromKubeConfig(kc, contextName, usedIds);
    if (entry) {
      clusterRegistry.set(entry.id, entry);
    }
  } else {
    for (const configPath of kubeconfigPaths) {
      try {
        const kc = new k8s.KubeConfig();
        kc.loadFromFile(configPath);

        // Load only the current-context from each file (per approved plan)
        const contextName = kc.getCurrentContext();
        if (!contextName) {
          console.warn(`[ClusterRegistry] No current-context in ${configPath}, skipping.`);
          continue;
        }

        const entry = loadClusterFromKubeConfig(kc, contextName, usedIds);
        if (entry) {
          clusterRegistry.set(entry.id, entry);
          console.log(`[ClusterRegistry] Loaded cluster "${entry.id}" from ${configPath} (context: ${contextName})`);
        }
      } catch (err) {
        console.error(`[ClusterRegistry] Failed to load ${configPath}: ${err.message}`);
        // Error isolation — skip bad files, don't crash
      }
    }
  }

  if (clusterRegistry.size === 0) {
    throw new Error(
      'No Kubernetes clusters could be loaded. Check your KUBECONFIGS or KUBECONFIG environment variable.'
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
