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

module.exports = {
  getResponseBody,
  parseResourceQuantity,
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

