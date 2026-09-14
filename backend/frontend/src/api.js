const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5100').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || payload.error || `Request failed with ${response.status}`);
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload;
}

const list = (path) => request(path).then((payload) => ({ data: payload.data || [], meta: payload.meta || {} }));
const data = (path) => request(path).then((payload) => payload.data);
const withNamespace = (path, namespace) => namespace ? `${path}?namespace=${encodeURIComponent(namespace)}` : path;

export const api = {
  url: API_URL,
  status: () => data('/api/status'),
  cluster: () => data('/api/cluster'),
  health: () => data('/api/health'),
  troubleshooting: () => data('/api/troubleshooting'),
  nodes: () => list('/api/nodes'),
  node: (name) => data(`/api/nodes/${encodeURIComponent(name)}`),
  namespaces: () => list('/api/namespaces'),
  namespace: (name) => data(`/api/namespaces/${encodeURIComponent(name)}`),
  pods: (namespace) => list(withNamespace('/api/pods', namespace)),
  pod: (namespace, name) => data(`/api/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  logs: (namespace, name, params = {}) => {
    const query = new URLSearchParams();
    if (params.container) query.set('container', params.container);
    if (params.tailLines) query.set('tailLines', params.tailLines);
    if (params.previous) query.set('previous', 'true');
    return data(`/api/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/logs${query.toString() ? `?${query}` : ''}`);
  },
  events: (namespace) => list(withNamespace('/api/events', namespace)),
  deployments: (namespace) => list(withNamespace('/api/deployments', namespace)),
  deployment: (namespace, name) => data(`/api/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  services: (namespace) => list(withNamespace('/api/services', namespace)),
  service: (namespace, name) => data(`/api/services/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  ingresses: (namespace) => list(withNamespace('/api/ingresses', namespace)),
  ingress: (namespace, name) => data(`/api/ingresses/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  statefulsets: (namespace) => list(withNamespace('/api/statefulsets', namespace)),
  statefulset: (namespace, name) => data(`/api/statefulsets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  daemonsets: (namespace) => list(withNamespace('/api/daemonsets', namespace)),
  daemonset: (namespace, name) => data(`/api/daemonsets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  gateways: (namespace) => list(withNamespace('/api/gateways', namespace)),
  gateway: (namespace, name) => data(`/api/gateways/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  gatewayClasses: () => list('/api/gateway-classes'),
  gatewayClass: (name) => data(`/api/gateway-classes/${encodeURIComponent(name)}`),
  httpRoutes: (namespace) => list(withNamespace('/api/http-routes', namespace)),
  httpRoute: (namespace, name) => data(`/api/http-routes/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  yaml: (resourceType, namespace, name) => {
    const pluralMap = {
      pod: 'pods',
      deployment: 'deployments',
      service: 'services',
      ingress: 'ingresses',
      statefulset: 'statefulsets',
      daemonset: 'daemonsets',
      node: 'nodes',
      namespace: 'namespaces',
      httproute: 'httproutes',
      httproutes: 'httproutes',
      gateway: 'gateways',
      gateways: 'gateways',
      gatewayclass: 'gatewayclasses',
      gatewayclasses: 'gatewayclasses',
      kongplugin: 'kongplugins',
      kongplugins: 'kongplugins',
    };
    const canonical = pluralMap[resourceType?.toLowerCase()] || resourceType;
    if (!namespace) {
      return data(`/api/resources/${encodeURIComponent(canonical)}/${encodeURIComponent(name)}/yaml`);
    }
    return data(`/api/resources/${encodeURIComponent(canonical)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/yaml`);
  },
};

