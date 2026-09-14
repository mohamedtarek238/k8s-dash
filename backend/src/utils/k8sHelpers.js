function parseResourceQuantity(quantity) {
  if (!quantity) return null;
  return String(quantity);
}

function getResponseBody(response) {
  return response?.body ?? response?.data ?? response ?? {};
}

function getNodeRoles(node) {
  const labels = node.metadata?.labels || {};
  const roles = [];

  if (labels['node-role.kubernetes.io/control-plane'] !== undefined) {
    roles.push('control-plane');
  }
  if (labels['node-role.kubernetes.io/master'] !== undefined) {
    roles.push('master');
  }
  if (labels['node.kubernetes.io/worker'] !== undefined) {
    roles.push('worker');
  }

  for (const key of Object.keys(labels)) {
    if (key.startsWith('node-role.kubernetes.io/')) {
      const role = key.replace('node-role.kubernetes.io/', '');
      if (!roles.includes(role)) {
        roles.push(role);
      }
    }
  }

  if (roles.length === 0) {
    roles.push('worker');
  }

  return roles;
}

function getNodeCondition(node, type) {
  return (node.status?.conditions || []).find((c) => c.type === type);
}

function isNodeReady(node) {
  const readyCondition = getNodeCondition(node, 'Ready');
  return readyCondition?.status === 'True';
}

function getPodRestartCount(pod) {
  return (pod.status?.containerStatuses || []).reduce(
    (sum, cs) => sum + (cs.restartCount || 0),
    0
  );
}

function getPodReadiness(pod) {
  const containerStatuses = pod.status?.containerStatuses || [];
  if (containerStatuses.length === 0) {
    return { ready: false, readyCount: 0, totalCount: 0 };
  }

  const readyCount = containerStatuses.filter((cs) => cs.ready).length;
  return {
    ready: readyCount === containerStatuses.length,
    readyCount,
    totalCount: containerStatuses.length,
  };
}

function mapContainerStatuses(containerStatuses = []) {
  return containerStatuses.map((cs) => ({
    name: cs.name,
    ready: cs.ready,
    restartCount: cs.restartCount || 0,
    started: cs.started,
    state: cs.state,
    lastState: cs.lastState,
    image: cs.image,
    imageID: cs.imageID,
    containerID: cs.containerID,
  }));
}

function mapContainers(containers = []) {
  return containers.map((c) => ({
    name: c.name,
    image: c.image,
    ports: c.ports,
    resources: c.resources,
    env: c.env?.length || 0,
  }));
}

function sortEventsByRecency(events) {
  return [...events].sort((a, b) => {
    const aTime = new Date(a.lastTimestamp || a.firstTimestamp || 0).getTime();
    const bTime = new Date(b.lastTimestamp || b.firstTimestamp || 0).getTime();
    return bTime - aTime;
  });
}

function involvedObjectToString(obj) {
  if (!obj) return null;
  const kind = obj.kind || 'Unknown';
  const name = obj.name || 'unknown';
  const ns = obj.namespace ? `${obj.namespace}/` : '';
  return `${kind}/${ns}${name}`;
}

function calculateAge(timestamp) {
  if (!timestamp) return null;
  const created = new Date(timestamp).getTime();
  if (Number.isNaN(created)) return null;
  const diffMs = Math.max(0, Date.now() - created);

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatServicePort(port) {
  if (!port) return '';
  const protocol = port.protocol || 'TCP';
  if (port.nodePort) {
    return `${port.port}:${port.nodePort}/${protocol}`;
  }
  if (port.targetPort && String(port.targetPort) !== String(port.port)) {
    return `${port.port}:${port.targetPort}/${protocol}`;
  }
  return `${port.port}/${protocol}`;
}

function parseQuantityToBytes(quantity) {
  if (quantity === null || quantity === undefined) {
    return null;
  }

  if (typeof quantity === 'number') {
    return Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
  }

  const str = String(quantity).trim();
  if (!str) {
    return null;
  }

  const match = str.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) {
    return null;
  }

  const num = parseFloat(match[1]);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return null;
  }

  const rawUnit = match[2];
  if (!rawUnit) {
    return num >= 0 ? num : null;
  }

  const binaryMultipliers = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
  };

  const decimalMultipliers = {
    m: 1e-3,
    k: 1e3,
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
  };

  if (binaryMultipliers[rawUnit] !== undefined) {
    return num * binaryMultipliers[rawUnit];
  }
  if (decimalMultipliers[rawUnit] !== undefined) {
    return num * decimalMultipliers[rawUnit];
  }

  const cleanUnit = (rawUnit.endsWith('B') || rawUnit.endsWith('b')) && rawUnit.length > 1 ? rawUnit.slice(0, -1) : rawUnit;
  const upperClean = cleanUnit.toUpperCase();

  const caseInsensitiveBinary = {
    KI: 1024,
    MI: 1024 ** 2,
    GI: 1024 ** 3,
    TI: 1024 ** 4,
    PI: 1024 ** 5,
    EI: 1024 ** 6,
  };

  if (caseInsensitiveBinary[upperClean] !== undefined) {
    return num * caseInsensitiveBinary[upperClean];
  }

  const caseInsensitiveDecimal = {
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
  };

  if (caseInsensitiveDecimal[upperClean] !== undefined) {
    return num * caseInsensitiveDecimal[upperClean];
  }

  if (upperClean === 'B' || upperClean === 'BYTES') {
    return num;
  }

  return null;
}

function formatMemoryQuantity(quantity) {
  if (quantity === null || quantity === undefined) {
    return '—';
  }

  if (typeof quantity === 'string' && quantity.trim() === '') {
    return '—';
  }

  const bytes = parseQuantityToBytes(quantity);
  if (bytes === null || Number.isNaN(bytes)) {
    return '—';
  }

  if (bytes === 0) {
    return '0 GiB';
  }

  const gib = bytes / (1024 ** 3);

  if (gib > 0 && gib < 0.01) {
    const formatted3 = parseFloat(gib.toFixed(3));
    if (formatted3 > 0) {
      return `${formatted3} GiB`;
    }
    return '< 0.01 GiB';
  }

  const rounded = parseFloat(gib.toFixed(2));
  return `${rounded} GiB`;
}

module.exports = {
  getResponseBody,
  parseResourceQuantity,
  parseQuantityToBytes,
  formatMemoryQuantity,
  getNodeRoles,
  getNodeCondition,
  isNodeReady,
  getPodRestartCount,
  getPodReadiness,
  mapContainerStatuses,
  mapContainers,
  sortEventsByRecency,
  involvedObjectToString,
  calculateAge,
  formatServicePort,
};

