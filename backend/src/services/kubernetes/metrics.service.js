const { getResponseBody } = require('../../utils/k8sHelpers');

function parseCpuQuantity(val) {
  if (val === null || val === undefined) return 0;
  const str = String(val).trim();
  if (!str) return 0;

  if (str.endsWith('n')) {
    return parseFloat(str.slice(0, -1)) / 1e6;
  }
  if (str.endsWith('u')) {
    return parseFloat(str.slice(0, -1)) / 1e3;
  }
  if (str.endsWith('m')) {
    return parseFloat(str.slice(0, -1));
  }
  const num = parseFloat(str);
  return Number.isFinite(num) ? num * 1000 : 0;
}

function formatCpu(millicores) {
  if (!millicores || millicores < 0) return '0m';
  if (millicores >= 1000) {
    const cores = millicores / 1000;
    return `${parseFloat(cores.toFixed(2))} cores`;
  }
  return `${Math.round(millicores)}m`;
}

function parseMemoryQuantity(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Number.isFinite(val) && val >= 0 ? val : 0;

  const str = String(val).trim();
  if (!str) return 0;

  const match = str.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0;

  const unit = match[2];
  if (!unit) return num >= 0 ? num : 0;

  const binaryUnits = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
    k: 1000,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
  };

  const cleanUnit = (unit.endsWith('B') || unit.endsWith('b')) && unit.length > 1 ? unit.slice(0, -1) : unit;
  const multiplier = binaryUnits[cleanUnit] || binaryUnits[unit] || 1;
  return num * multiplier;
}

function formatMemory(bytes) {
  if (!bytes || bytes <= 0) return '0 GiB';
  const gib = bytes / (1024 ** 3);
  if (gib > 0 && gib < 0.01) {
    return '< 0.01 GiB';
  }
  return `${parseFloat(gib.toFixed(2))} GiB`;
}

async function getClusterMetrics(clients) {
  const { customObjectsApi, coreV1Api } = clients;

  if (!customObjectsApi || !coreV1Api) {
    return {
      available: false,
      message: 'Kubernetes API clients not available',
    };
  }

  try {
    const [metricsSettled, nodesSettled] = await Promise.allSettled([
      customObjectsApi.listClusterCustomObject({
        group: 'metrics.k8s.io',
        version: 'v1beta1',
        plural: 'nodes',
      }),
      coreV1Api.listNode(),
    ]);

    if (metricsSettled.status !== 'fulfilled') {
      return {
        available: false,
        message: 'Live metrics unavailable (metrics.k8s.io not accessible)',
      };
    }

    const metricsBody = getResponseBody(metricsSettled.value);
    const metricItems = metricsBody.items || [];

    const nodesBody = nodesSettled.status === 'fulfilled' ? getResponseBody(nodesSettled.value) : {};
    const nodeItems = nodesBody.items || [];

    const nodeSpecMap = new Map();
    for (const node of nodeItems) {
      if (node.metadata?.name) {
        nodeSpecMap.set(node.metadata.name, node);
      }
    }

    let totalCpuUsage = 0;
    let totalCpuCapacity = 0;
    let totalCpuAllocatable = 0;

    let totalMemUsage = 0;
    let totalMemCapacity = 0;
    let totalMemAllocatable = 0;

    const nodeMetrics = [];

    for (const item of metricItems) {
      const name = item.metadata?.name;
      const nodeSpec = nodeSpecMap.get(name);

      const cpuUsage = parseCpuQuantity(item.usage?.cpu);
      const memUsage = parseMemoryQuantity(item.usage?.memory);

      const cpuCap = nodeSpec ? parseCpuQuantity(nodeSpec.status?.capacity?.cpu) : 0;
      const cpuAlloc = nodeSpec ? parseCpuQuantity(nodeSpec.status?.allocatable?.cpu) : cpuCap;

      const memCap = nodeSpec ? parseMemoryQuantity(nodeSpec.status?.capacity?.memory) : 0;
      const memAlloc = nodeSpec ? parseMemoryQuantity(nodeSpec.status?.allocatable?.memory) : memCap;

      totalCpuUsage += cpuUsage;
      totalCpuCapacity += cpuCap;
      totalCpuAllocatable += cpuAlloc;

      totalMemUsage += memUsage;
      totalMemCapacity += memCap;
      totalMemAllocatable += memAlloc;

      const cpuPercentage = cpuAlloc > 0 ? Math.min(100, Math.round((cpuUsage / cpuAlloc) * 100)) : 0;
      const memPercentage = memAlloc > 0 ? Math.min(100, Math.round((memUsage / memAlloc) * 100)) : 0;

      nodeMetrics.push({
        name,
        timestamp: item.timestamp,
        window: item.window,
        cpu: {
          usage: cpuUsage,
          usageFormatted: formatCpu(cpuUsage),
          capacity: cpuCap,
          capacityFormatted: formatCpu(cpuCap),
          allocatable: cpuAlloc,
          allocatableFormatted: formatCpu(cpuAlloc),
          usagePercentage: cpuPercentage,
        },
        memory: {
          usage: memUsage,
          usageFormatted: formatMemory(memUsage),
          capacity: memCap,
          capacityFormatted: formatMemory(memCap),
          allocatable: memAlloc,
          allocatableFormatted: formatMemory(memAlloc),
          usagePercentage: memPercentage,
        },
      });
    }

    const clusterCpuPercentage =
      totalCpuAllocatable > 0 ? Math.min(100, Math.round((totalCpuUsage / totalCpuAllocatable) * 100)) : 0;
    const clusterMemPercentage =
      totalMemAllocatable > 0 ? Math.min(100, Math.round((totalMemUsage / totalMemAllocatable) * 100)) : 0;

    return {
      available: true,
      cluster: {
        cpu: {
          usage: totalCpuUsage,
          usageFormatted: formatCpu(totalCpuUsage),
          capacity: totalCpuCapacity,
          capacityFormatted: formatCpu(totalCpuCapacity),
          allocatable: totalCpuAllocatable,
          allocatableFormatted: formatCpu(totalCpuAllocatable),
          usagePercentage: clusterCpuPercentage,
        },
        memory: {
          usage: totalMemUsage,
          usageFormatted: formatMemory(totalMemUsage),
          capacity: totalMemCapacity,
          capacityFormatted: formatMemory(totalMemCapacity),
          allocatable: totalMemAllocatable,
          allocatableFormatted: formatMemory(totalMemAllocatable),
          usagePercentage: clusterMemPercentage,
        },
      },
      nodes: nodeMetrics,
    };
  } catch (err) {
    return {
      available: false,
      message: err.message || 'Error fetching metrics',
    };
  }
}

module.exports = {
  parseCpuQuantity,
  formatCpu,
  parseMemoryQuantity,
  formatMemory,
  getClusterMetrics,
};
