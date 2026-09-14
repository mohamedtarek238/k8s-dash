const fs = require('fs');
const os = require('os');
const path = require('path');
const k8s = require('@kubernetes/client-node');

let kubeConfig;
let coreV1Api;
let appsV1Api;
let batchV1Api;
let networkingV1Api;
let customObjectsApi;
let versionApi;
let initialized = false;

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

function initializeKubernetesClients() {
  if (initialized) {
    return {
      kubeConfig,
      coreV1Api,
      appsV1Api,
      batchV1Api,
      networkingV1Api,
      customObjectsApi,
      versionApi,
    };
  }

  kubeConfig = new k8s.KubeConfig();

  const kubeconfigPath = resolveKubeconfigPath();
  if (kubeconfigPath) {
    kubeConfig.loadFromFile(kubeconfigPath);
  } else {
    kubeConfig.loadFromDefault();
  }

  assertValidKubeConfig(kubeConfig);

  coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);
  appsV1Api = kubeConfig.makeApiClient(k8s.AppsV1Api);
  batchV1Api = kubeConfig.makeApiClient(k8s.BatchV1Api);
  networkingV1Api = kubeConfig.makeApiClient(k8s.NetworkingV1Api);
  customObjectsApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
  versionApi = kubeConfig.makeApiClient(k8s.VersionApi);

  initialized = true;

  return {
    kubeConfig,
    coreV1Api,
    appsV1Api,
    batchV1Api,
    networkingV1Api,
    customObjectsApi,
    versionApi,
  };
}

function getCurrentContext() {
  const { kubeConfig: kc } = initializeKubernetesClients();
  return kc.getCurrentContext();
}

function getCurrentCluster() {
  const { kubeConfig: kc } = initializeKubernetesClients();
  const context = kc.getCurrentContext();
  const contextObj = kc.getContextObject(context);
  return contextObj?.cluster || null;
}

function getClusterServer() {
  const { kubeConfig: kc } = initializeKubernetesClients();
  const clusterName = getCurrentCluster();
  if (!clusterName) return null;
  const cluster = kc.clusters.find((c) => c.name === clusterName);
  return cluster?.server || null;
}

module.exports = {
  initializeKubernetesClients,
  getCurrentContext,
  getCurrentCluster,
  getClusterServer,
};
