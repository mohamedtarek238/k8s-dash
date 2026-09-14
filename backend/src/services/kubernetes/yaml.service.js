const yaml = require('js-yaml');
const { initializeKubernetesClients } = require('../../config/kubernetes');
const { getResponseBody } = require('../../utils/k8sHelpers');

const SUPPORTED_RESOURCES = {
  pod: {
    canonical: 'pods',
    namespaced: true,
    apiVersion: 'v1',
    kind: 'Pod',
    fetch: (clients, { namespace, name }) =>
      clients.coreV1Api.readNamespacedPod({ name, namespace }),
  },
  pods: {
    canonical: 'pods',
    namespaced: true,
    apiVersion: 'v1',
    kind: 'Pod',
    fetch: (clients, { namespace, name }) =>
      clients.coreV1Api.readNamespacedPod({ name, namespace }),
  },
  deployment: {
    canonical: 'deployments',
    namespaced: true,
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    fetch: (clients, { namespace, name }) =>
      clients.appsV1Api.readNamespacedDeployment({ name, namespace }),
  },
  deployments: {
    canonical: 'deployments',
    namespaced: true,
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    fetch: (clients, { namespace, name }) =>
      clients.appsV1Api.readNamespacedDeployment({ name, namespace }),
  },
  service: {
    canonical: 'services',
    namespaced: true,
    apiVersion: 'v1',
    kind: 'Service',
    fetch: (clients, { namespace, name }) =>
      clients.coreV1Api.readNamespacedService({ name, namespace }),
  },
  services: {
    canonical: 'services',
    namespaced: true,
    apiVersion: 'v1',
    kind: 'Service',
    fetch: (clients, { namespace, name }) =>
      clients.coreV1Api.readNamespacedService({ name, namespace }),
  },
  ingress: {
    canonical: 'ingresses',
    namespaced: true,
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    fetch: (clients, { namespace, name }) =>
      clients.networkingV1Api.readNamespacedIngress({ name, namespace }),
  },
  ingresses: {
    canonical: 'ingresses',
    namespaced: true,
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    fetch: (clients, { namespace, name }) =>
      clients.networkingV1Api.readNamespacedIngress({ name, namespace }),
  },
  statefulset: {
    canonical: 'statefulsets',
    namespaced: true,
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    fetch: (clients, { namespace, name }) =>
      clients.appsV1Api.readNamespacedStatefulSet({ name, namespace }),
  },
  statefulsets: {
    canonical: 'statefulsets',
    namespaced: true,
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    fetch: (clients, { namespace, name }) =>
      clients.appsV1Api.readNamespacedStatefulSet({ name, namespace }),
  },
  daemonset: {
    canonical: 'daemonsets',
    namespaced: true,
    apiVersion: 'apps/v1',
    kind: 'DaemonSet',
    fetch: (clients, { namespace, name }) =>
      clients.appsV1Api.readNamespacedDaemonSet({ name, namespace }),
  },
  daemonsets: {
    canonical: 'daemonsets',
    namespaced: true,
    apiVersion: 'apps/v1',
    kind: 'DaemonSet',
    fetch: (clients, { namespace, name }) =>
      clients.appsV1Api.readNamespacedDaemonSet({ name, namespace }),
  },
  namespace: {
    canonical: 'namespaces',
    namespaced: false,
    apiVersion: 'v1',
    kind: 'Namespace',
    fetch: (clients, { name }) =>
      clients.coreV1Api.readNamespace({ name }),
  },
  namespaces: {
    canonical: 'namespaces',
    namespaced: false,
    apiVersion: 'v1',
    kind: 'Namespace',
    fetch: (clients, { name }) =>
      clients.coreV1Api.readNamespace({ name }),
  },
  node: {
    canonical: 'nodes',
    namespaced: false,
    apiVersion: 'v1',
    kind: 'Node',
    fetch: (clients, { name }) =>
      clients.coreV1Api.readNode({ name }),
  },
  nodes: {
    canonical: 'nodes',
    namespaced: false,
    apiVersion: 'v1',
    kind: 'Node',
    fetch: (clients, { name }) =>
      clients.coreV1Api.readNode({ name }),
  },
  httproute: {
    canonical: 'httproutes',
    namespaced: true,
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
    fetch: (clients, { namespace, name }) =>
      clients.customObjectsApi.getNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        name,
      }),
  },
  httproutes: {
    canonical: 'httproutes',
    namespaced: true,
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
    fetch: (clients, { namespace, name }) =>
      clients.customObjectsApi.getNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        name,
      }),
  },
  gateway: {
    canonical: 'gateways',
    namespaced: true,
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'Gateway',
    fetch: (clients, { namespace, name }) =>
      clients.customObjectsApi.getNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'gateways',
        name,
      }),
  },
  gateways: {
    canonical: 'gateways',
    namespaced: true,
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'Gateway',
    fetch: (clients, { namespace, name }) =>
      clients.customObjectsApi.getNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'gateways',
        name,
      }),
  },
  gatewayclass: {
    canonical: 'gatewayclasses',
    namespaced: false,
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'GatewayClass',
    fetch: (clients, { name }) =>
      clients.customObjectsApi.getClusterCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        plural: 'gatewayclasses',
        name,
      }),
  },
  gatewayclasses: {
    canonical: 'gatewayclasses',
    namespaced: false,
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'GatewayClass',
    fetch: (clients, { name }) =>
      clients.customObjectsApi.getClusterCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        plural: 'gatewayclasses',
        name,
      }),
  },
  kongplugin: {
    canonical: 'kongplugins',
    namespaced: true,
    apiVersion: 'configuration.konghq.com/v1',
    kind: 'KongPlugin',
    fetch: (clients, { namespace, name }) =>
      clients.customObjectsApi.getNamespacedCustomObject({
        group: 'configuration.konghq.com',
        version: 'v1',
        namespace,
        plural: 'kongplugins',
        name,
      }),
  },
  kongplugins: {
    canonical: 'kongplugins',
    namespaced: true,
    apiVersion: 'configuration.konghq.com/v1',
    kind: 'KongPlugin',
    fetch: (clients, { namespace, name }) =>
      clients.customObjectsApi.getNamespacedCustomObject({
        group: 'configuration.konghq.com',
        version: 'v1',
        namespace,
        plural: 'kongplugins',
        name,
      }),
  },
};

/**
 * Converts a @kubernetes/client-node model instance to a plain POJO
 * so js-yaml can serialize it without constructor errors.
 */
function toPlainObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Normalizes a live Kubernetes object to guarantee apiVersion and kind are present
 * at the top of the object, preserving all other fields (metadata, spec, status, etc.).
 */
function normalizeKubernetesObject(raw, defaultApiVersion, defaultKind) {
  const plain = toPlainObject(raw);
  const apiVersion = plain.apiVersion || defaultApiVersion;
  const kind = plain.kind || defaultKind;

  const result = {
    apiVersion,
    kind,
    metadata: plain.metadata || {},
  };

  if (plain.spec !== undefined) {
    result.spec = plain.spec;
  }
  if (plain.status !== undefined) {
    result.status = plain.status;
  }

  for (const [key, value] of Object.entries(plain)) {
    if (!['apiVersion', 'kind', 'metadata', 'spec', 'status'].includes(key)) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Fetches the live Kubernetes resource and generates formatted YAML.
 * @param {string} resourceType - Resource type (pods, deployments, nodes, etc.)
 * @param {object} params - { namespace, name }
 */
async function getResourceYaml(resourceType, { namespace, name }) {
  const normalizedType = String(resourceType || '').toLowerCase().trim();
  const config = SUPPORTED_RESOURCES[normalizedType];

  if (!config) {
    const error = new Error(`Unsupported resource type: '${resourceType}'`);
    error.statusCode = 400;
    throw error;
  }

  if (config.namespaced && !namespace) {
    const error = new Error(`Resource '${resourceType}' is namespaced. A namespace is required.`);
    error.statusCode = 400;
    throw error;
  }

  if (!config.namespaced && namespace) {
    const error = new Error(`Resource '${resourceType}' is cluster-scoped. Do not provide a namespace.`);
    error.statusCode = 400;
    throw error;
  }

  const clients = initializeKubernetesClients();
  const response = await config.fetch(clients, { namespace, name });
  const rawObj = getResponseBody(response);

  const normalized = normalizeKubernetesObject(rawObj, config.apiVersion, config.kind);

  const yamlString = yaml.dump(normalized, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });

  return {
    yaml: yamlString,
    kind: normalized.kind,
    apiVersion: normalized.apiVersion,
    name: normalized.metadata?.name || name,
    namespace: normalized.metadata?.namespace || namespace || null,
  };
}

module.exports = {
  SUPPORTED_RESOURCES,
  getResourceYaml,
  normalizeKubernetesObject,
};
