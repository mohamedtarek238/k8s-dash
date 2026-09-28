const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5100').replace(/\/$/, '');

function toCanonicalClusterId(val) {
  if (!val) return null;
  if (Array.isArray(val)) return toCanonicalClusterId(val[0]);
  if (typeof val === 'object' && val !== null) return toCanonicalClusterId(val.id);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes(',')) return trimmed.split(',')[0].trim();
    return trimmed || null;
  }
  return null;
}

let currentClusterId = toCanonicalClusterId(localStorage.getItem('k8s-dashboard-cluster')) || null;

function setCluster(clusterId) {
  const canonical = toCanonicalClusterId(clusterId);
  currentClusterId = canonical;
  if (canonical) {
    localStorage.setItem('k8s-dashboard-cluster', canonical);
  } else {
    localStorage.removeItem('k8s-dashboard-cluster');
  }
}

function getCluster() {
  return currentClusterId;
}

function appendClusterParam(path) {
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);

  // If cluster is already specified in the path, normalize it and do NOT append another one
  if (params.has('cluster')) {
    const existing = params.get('cluster');
    const canonical = toCanonicalClusterId(existing);
    if (canonical) {
      params.set('cluster', canonical);
    } else if (currentClusterId) {
      params.set('cluster', currentClusterId);
    }
  } else if (currentClusterId) {
    params.set('cluster', currentClusterId);
  }

  const queryStr = params.toString();
  return queryStr ? `${pathname}?${queryStr}` : pathname;
}

const TOKEN_KEY = 'k8s-dashboard-token';
const USER_KEY = 'k8s-dashboard-user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

async function request(path, options = {}) {
  const fullPath = appendClusterParam(path);
  const token = getToken();
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${fullPath}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/login')) {
    clearAuth();
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  if (!response.ok || payload.success === false) {
    const msg = (payload.error && typeof payload.error === 'object' && payload.error.message)
      || (typeof payload.error === 'string' && payload.error)
      || payload.message
      || `Request failed with ${response.status}`;
    const error = new Error(msg);
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
  setCluster,
  getCluster,
  auth: {
    login: async (username, password) => {
      const payload = await request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const { token, user } = payload.data || {};
      if (token) setToken(token);
      if (user) setUser(user);
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));
      return { token, user };
    },
    logout: () => {
      clearAuth();
    },
    me: async () => {
      const payload = await request('/api/auth/me');
      const user = payload.data?.user || payload.data;
      if (user) setUser(user);
      return user;
    },
    getToken,
    setToken,
    getUser,
    setUser,
    isAuthenticated: () => !!getToken(),
    clearAuth,
  },
  clusters: () => list('/api/clusters'),
  status: () => data('/api/status'),
  cluster: () => data('/api/cluster'),
  health: () => data('/api/health'),
  metricsOverview: () => data('/api/metrics/overview'),
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
  jobs: (namespace) => list(withNamespace('/api/jobs', namespace)),
  job: (namespace, name) => data(`/api/jobs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  cronjobs: (namespace) => list(withNamespace('/api/cronjobs', namespace)),
  cronjob: (namespace, name) => data(`/api/cronjobs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  gateways: (namespace) => list(withNamespace('/api/gateways', namespace)),
  gateway: (namespace, name) => data(`/api/gateways/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  gatewayClasses: () => list('/api/gateway-classes'),
  gatewayClass: (name) => data(`/api/gateway-classes/${encodeURIComponent(name)}`),
  httpRoutes: (namespace) => list(withNamespace('/api/http-routes', namespace)),
  httpRoute: (namespace, name) => data(`/api/http-routes/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  operators: () => list('/api/operators'),
  crds: (params = {}) => {
    const query = new URLSearchParams();
    if (params.group) query.set('group', params.group);
    if (params.search) query.set('search', params.search);
    return list(`/api/crds${query.toString() ? `?${query}` : ''}`);
  },
  crd: (name) => data(`/api/crds/${encodeURIComponent(name)}`),
  crdYaml: (name) => data(`/api/crds/${encodeURIComponent(name)}/yaml`),
  customResources: (group, version, plural, params = {}) => {
    const query = new URLSearchParams();
    if (params.namespace) query.set('namespace', params.namespace);
    if (params.scope) query.set('scope', params.scope);
    return list(`/api/custom-resources/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(plural)}${query.toString() ? `?${query}` : ''}`);
  },
  customResource: (group, version, plural, namespace, name, scope = 'Namespaced') => {
    const isNamespaced = scope.toLowerCase() === 'namespaced' && namespace;
    if (isNamespaced) {
      return data(`/api/custom-resources/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(plural)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`);
    }
    return data(`/api/custom-resources/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(plural)}/${encodeURIComponent(name)}`);
  },
  customResourceYaml: (group, version, plural, namespace, name, scope = 'Namespaced') => {
    const isNamespaced = scope.toLowerCase() === 'namespaced' && namespace;
    if (isNamespaced) {
      return data(`/api/custom-resources/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(plural)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/yaml`);
    }
    return data(`/api/custom-resources/${encodeURIComponent(group)}/${encodeURIComponent(version)}/${encodeURIComponent(plural)}/${encodeURIComponent(name)}/yaml`);
  },
  storageOverview: () => data('/api/storage/overview'),
  persistentVolumes: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    return list(`/api/storage/persistentvolumes${query.toString() ? `?${query}` : ''}`);
  },
  persistentVolume: (name) => data(`/api/storage/persistentvolumes/${encodeURIComponent(name)}?includeEvents=true`),
  persistentVolumeClaims: (namespace, params = {}) => {
    const query = new URLSearchParams();
    if (namespace) query.set('namespace', namespace);
    if (params.search) query.set('search', params.search);
    return list(`/api/storage/persistentvolumeclaims${query.toString() ? `?${query}` : ''}`);
  },
  persistentVolumeClaim: (namespace, name) => data(`/api/storage/persistentvolumeclaims/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}?includeEvents=true`),
  storageClasses: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    return list(`/api/storage/storageclasses${query.toString() ? `?${query}` : ''}`);
  },
  storageClass: (name) => data(`/api/storage/storageclasses/${encodeURIComponent(name)}`),
  csiDrivers: () => list('/api/storage/csidrivers'),
  csiDriver: (name) => data(`/api/storage/csidrivers/${encodeURIComponent(name)}`),
  volumeSnapshots: (namespace) => data(withNamespace('/api/storage/volumesnapshots', namespace)),
  volumeSnapshot: (namespace, name) => data(`/api/storage/volumesnapshots/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`),
  volumeSnapshotClasses: () => data('/api/storage/volumesnapshotclasses'),
  volumeSnapshotClass: (name) => data(`/api/storage/volumesnapshotclasses/${encodeURIComponent(name)}`),
  volumeSnapshotContents: () => data('/api/storage/volumesnapshotcontents'),
  volumeSnapshotContent: (name) => data(`/api/storage/volumesnapshotcontents/${encodeURIComponent(name)}`),
  rbacOverview: () => data('/api/rbac/overview'),
  rbacAnalysis: () => data('/api/rbac/analysis'),
  serviceAccounts: (namespace, params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    return list(withNamespace('/api/rbac/serviceaccounts', namespace) + (query.toString() ? `${namespace ? '&' : '?'}${query}` : ''));
  },
  serviceAccount: (namespace, name) => data(`/api/rbac/serviceaccounts/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}?includeRelated=true&includeEvents=true`),
  roles: (namespace, params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    return list(withNamespace('/api/rbac/roles', namespace) + (query.toString() ? `${namespace ? '&' : '?'}${query}` : ''));
  },
  role: (namespace, name) => data(`/api/rbac/roles/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}?includeRelated=true&includeEvents=true`),
  roleBindings: (namespace, params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    return list(withNamespace('/api/rbac/rolebindings', namespace) + (query.toString() ? `${namespace ? '&' : '?'}${query}` : ''));
  },
  roleBinding: (namespace, name) => data(`/api/rbac/rolebindings/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}?includeRelated=true&includeEvents=true`),
  clusterRoles: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    return list(`/api/rbac/clusterroles${query.toString() ? `?${query}` : ''}`);
  },
  clusterRole: (name) => data(`/api/rbac/clusterroles/${encodeURIComponent(name)}?includeRelated=true`),
  clusterRoleBindings: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    return list(`/api/rbac/clusterrolebindings${query.toString() ? `?${query}` : ''}`);
  },
  clusterRoleBinding: (name) => data(`/api/rbac/clusterrolebindings/${encodeURIComponent(name)}?includeRelated=true`),
  auditStatus: (cluster) => {
    const cId = toCanonicalClusterId(cluster) || currentClusterId;
    return data(cId ? `/api/audit/status?cluster=${encodeURIComponent(cId)}` : '/api/audit/status');
  },
  auditEvents: (params = {}) => {
    const query = new URLSearchParams();
    const cId = toCanonicalClusterId(params.cluster) || currentClusterId;
    if (cId) query.set('cluster', cId);
    if (params.namespace && params.namespace !== 'all') query.set('namespace', params.namespace);
    if (params.search) query.set('search', params.search);
    if (params.verb && params.verb !== 'all') query.set('verb', params.verb);
    if (params.resource && params.resource !== 'all') query.set('resource', params.resource);
    if (params.apiGroup && params.apiGroup !== 'all') query.set('apiGroup', params.apiGroup);
    if (params.user) query.set('user', params.user);
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.limit) query.set('limit', params.limit);
    if (params.offset !== undefined && params.offset !== null) query.set('offset', params.offset);
    return data(`/api/audit/events${query.toString() ? `?${query}` : ''}`);
  },
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
      job: 'jobs',
      jobs: 'jobs',
      cronjob: 'cronjobs',
      cronjobs: 'cronjobs',
      httproute: 'httproutes',
      httproutes: 'httproutes',
      gateway: 'gateways',
      gateways: 'gateways',
      gatewayclass: 'gatewayclasses',
      gatewayclasses: 'gatewayclasses',
      kongplugin: 'kongplugins',
      kongplugins: 'kongplugins',
      crd: 'crds',
      crds: 'crds',
      customresourcedefinition: 'crds',
      pv: 'persistentvolumes',
      pvs: 'persistentvolumes',
      persistentvolume: 'persistentvolumes',
      persistentvolumes: 'persistentvolumes',
      pvc: 'persistentvolumeclaims',
      pvcs: 'persistentvolumeclaims',
      persistentvolumeclaim: 'persistentvolumeclaims',
      persistentvolumeclaims: 'persistentvolumeclaims',
      sc: 'storageclasses',
      scs: 'storageclasses',
      storageclass: 'storageclasses',
      storageclasses: 'storageclasses',
      csidriver: 'csidrivers',
      csidrivers: 'csidrivers',
      volumesnapshot: 'volumesnapshots',
      volumesnapshots: 'volumesnapshots',
      volumesnapshotclass: 'volumesnapshotclasses',
      volumesnapshotclasses: 'volumesnapshotclasses',
      volumesnapshotcontent: 'volumesnapshotcontents',
      volumesnapshotcontents: 'volumesnapshotcontents',
      sa: 'serviceaccounts',
      serviceaccount: 'serviceaccounts',
      serviceaccounts: 'serviceaccounts',
      role: 'roles',
      roles: 'roles',
      rolebinding: 'rolebindings',
      rolebindings: 'rolebindings',
      clusterrole: 'clusterroles',
      clusterroles: 'clusterroles',
      clusterrolebinding: 'clusterrolebindings',
      clusterrolebindings: 'clusterrolebindings',
    };
    const canonical = pluralMap[resourceType?.toLowerCase()] || resourceType;
    if (!namespace) {
      return data(`/api/resources/${encodeURIComponent(canonical)}/${encodeURIComponent(name)}/yaml`);
    }
    return data(`/api/resources/${encodeURIComponent(canonical)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/yaml`);
  },
};
