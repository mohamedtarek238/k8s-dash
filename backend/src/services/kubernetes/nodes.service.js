const { initializeKubernetesClients } = require('../../config/kubernetes');
const {
  parseResourceQuantity,
  getNodeRoles,
  getNodeCondition,
  getResponseBody,
} = require('../../utils/k8sHelpers');

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

async function listNodes() {
  const { coreV1Api } = initializeKubernetesClients();
  const response = await coreV1Api.listNode();
  return (getResponseBody(response).items || []).map(mapNode);
}

module.exports = {
  listNodes,
};
