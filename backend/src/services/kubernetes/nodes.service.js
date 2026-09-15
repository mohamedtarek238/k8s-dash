const {
  parseResourceQuantity,
  getNodeRoles,
  getNodeCondition,
  isNodeReady,
  getResponseBody,
  calculateAge,
  getPodReadiness,
  getPodRestartCount,
} = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');

function mapNode(node) {
  const status = node.status || {};
  const readyCondition = getNodeCondition(node, 'Ready');

  return {
    name: node.metadata.name,
    status: readyCondition?.status === 'True' ? 'Ready' : 'NotReady',
    roles: getNodeRoles(node),
    kubernetesVersion: status.nodeInfo?.kubeletVersion || null,
    os: status.nodeInfo?.osImage || null,
    architecture: status.nodeInfo?.architecture || null,
    cpuCapacity: parseResourceQuantity(status.capacity?.cpu),
    memoryCapacity: parseResourceQuantity(status.capacity?.memory),
    allocatableCpu: parseResourceQuantity(status.allocatable?.cpu),
    allocatableMemory: parseResourceQuantity(status.allocatable?.memory),
    conditions: (status.conditions || []).map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
      lastTransitionTime: c.lastTransitionTime,
    })),
    creationTimestamp: node.metadata.creationTimestamp,
  };
}

function mapNodeDetails(node, { relatedPods, events } = {}) {
  const status = node.status || {};
  const nodeInfo = status.nodeInfo || {};
  const ready = isNodeReady(node);

  const data = {
    name: node.metadata.name,
    uid: node.metadata.uid,
    resourceVersion: node.metadata.resourceVersion,
    creationTimestamp: node.metadata.creationTimestamp,
    age: calculateAge(node.metadata.creationTimestamp),
    labels: node.metadata.labels || {},
    annotations: node.metadata.annotations || {},
    roles: getNodeRoles(node),
    architecture: nodeInfo.architecture || null,
    operatingSystem: nodeInfo.operatingSystem || null,
    kubeletVersion: nodeInfo.kubeletVersion || null,
    containerRuntimeVersion: nodeInfo.containerRuntimeVersion || null,
    capacity: status.capacity || {},
    allocatable: status.allocatable || {},
    conditions: (status.conditions || []).map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
      lastHeartbeatTime: c.lastHeartbeatTime,
      lastTransitionTime: c.lastTransitionTime,
    })),
    addresses: (status.addresses || []).map((a) => ({
      type: a.type,
      address: a.address,
    })),
    taints: (node.spec?.taints || []).map((t) => ({
      key: t.key,
      value: t.value,
      effect: t.effect,
      timeAdded: t.timeAdded,
    })),
    unschedulable: Boolean(node.spec?.unschedulable),
    podCIDRs: node.spec?.podCIDRs || (node.spec?.podCIDR ? [node.spec.podCIDR] : []),
    health: {
      status: ready ? 'Ready' : 'NotReady',
      ready,
      memoryPressure: getNodeCondition(node, 'MemoryPressure')?.status === 'True',
      diskPressure: getNodeCondition(node, 'DiskPressure')?.status === 'True',
      pidPressure: getNodeCondition(node, 'PIDPressure')?.status === 'True',
      networkUnavailable: getNodeCondition(node, 'NetworkUnavailable')?.status === 'True',
    },
    nodeInfo: {
      machineID: nodeInfo.machineID,
      systemUUID: nodeInfo.systemUUID,
      bootID: nodeInfo.bootID,
      kernelVersion: nodeInfo.kernelVersion,
      osImage: nodeInfo.osImage,
      containerRuntimeVersion: nodeInfo.containerRuntimeVersion,
      kubeletVersion: nodeInfo.kubeletVersion,
      kubeProxyVersion: nodeInfo.kubeProxyVersion,
      operatingSystem: nodeInfo.operatingSystem,
      architecture: nodeInfo.architecture,
    },
  };

  if (relatedPods !== undefined) {
    data.related = {
      pods: relatedPods,
      totalPods: relatedPods.length,
    };
  }

  if (events !== undefined) {
    data.events = events;
  }

  return data;
}

async function listNodes(clients) {
  const { coreV1Api } = clients;
  const response = await coreV1Api.listNode();
  return (getResponseBody(response).items || []).map(mapNode);
}

async function getNodeDetails(name, { includeRelated = false, includeEvents = false } = {}, clients) {
  const { coreV1Api } = clients;
  const response = await coreV1Api.readNode({ name });
  const node = getResponseBody(response);

  let relatedPods;
  if (includeRelated) {
    const podsResponse = await coreV1Api.listPodForAllNamespaces({
      fieldSelector: `spec.nodeName=${name}`,
    });
    const podItems = getResponseBody(podsResponse).items || [];
    relatedPods = podItems.map((p) => ({
      name: p.metadata.name,
      namespace: p.metadata.namespace,
      status: p.status?.phase || 'Unknown',
      podIP: p.status?.podIP || null,
      nodeName: p.spec?.nodeName || null,
      readiness: getPodReadiness(p),
      restartCount: getPodRestartCount(p),
      creationTimestamp: p.metadata.creationTimestamp,
      age: calculateAge(p.metadata.creationTimestamp),
    }));
  }

  let events;
  if (includeEvents) {
    events = await getResourceEvents({ kind: 'Node', name, uid: node.metadata?.uid }, clients);
  }

  return mapNodeDetails(node, { relatedPods, events });
}

module.exports = {
  listNodes,
  getNodeDetails,
};

