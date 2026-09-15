const {
  getResponseBody,
  getNodeCondition,
  isNodeReady,
  getPodRestartCount,
} = require('../../utils/k8sHelpers');

const FREQUENT_RESTART_THRESHOLD = 5;

function createIssue({ severity, resourceType, resourceName, namespace, reason, message, recommendation }) {
  return {
    severity,
    resourceType,
    resourceName,
    namespace: namespace || null,
    reason,
    message,
    recommendation,
  };
}

function getContainerWaitingReason(containerStatus) {
  return containerStatus?.state?.waiting?.reason || null;
}

function getContainerTerminatedReason(containerStatus) {
  return containerStatus?.state?.terminated?.reason || null;
}

function getContainerLastTerminatedReason(containerStatus) {
  return containerStatus?.lastState?.terminated?.reason || null;
}

async function collectClusterIssues(clients) {
  const { coreV1Api, appsV1Api } = clients;

  const [nodesResponse, podsResponse, deploymentsResponse] = await Promise.all([
    coreV1Api.listNode(),
    coreV1Api.listPodForAllNamespaces(),
    appsV1Api.listDeploymentForAllNamespaces(),
  ]);

  const issues = [];
  const nodes = getResponseBody(nodesResponse).items || [];
  const pods = getResponseBody(podsResponse).items || [];
  const deployments = getResponseBody(deploymentsResponse).items || [];

  for (const node of nodes) {
    const nodeName = node.metadata.name;

    if (!isNodeReady(node)) {
      const readyCondition = getNodeCondition(node, 'Ready');
      issues.push(
        createIssue({
          severity: 'critical',
          resourceType: 'Node',
          resourceName: nodeName,
          reason: readyCondition?.reason || 'NotReady',
          message: readyCondition?.message || `Node ${nodeName} is not ready`,
          recommendation:
            'Inspect node conditions and kubelet logs. Verify network, disk, and resource availability on the node.',
        })
      );
    }

    for (const pressureType of ['DiskPressure', 'MemoryPressure', 'PIDPressure']) {
      const condition = getNodeCondition(node, pressureType);
      if (condition?.status === 'True') {
        issues.push(
          createIssue({
            severity: pressureType === 'MemoryPressure' ? 'critical' : 'warning',
            resourceType: 'Node',
            resourceName: nodeName,
            reason: pressureType,
            message: condition.message || `Node ${nodeName} reports ${pressureType}`,
            recommendation:
              'Free resources on the node or reschedule workloads. Consider adding capacity or enabling cluster autoscaling.',
          })
        );
      }
    }
  }

  for (const pod of pods) {
    const podName = pod.metadata.name;
    const namespace = pod.metadata.namespace;
    const phase = pod.status?.phase;
    const containerStatuses = pod.status?.containerStatuses || [];

    if (phase === 'Pending') {
      issues.push(
        createIssue({
          severity: 'warning',
          resourceType: 'Pod',
          resourceName: podName,
          namespace,
          reason: pod.status?.reason || 'Pending',
          message: pod.status?.message || `Pod ${namespace}/${podName} is pending scheduling`,
          recommendation:
            'Check node capacity, taints/tolerations, PVC binding, and scheduling events for this pod.',
        })
      );
    }

    if (phase === 'Failed') {
      issues.push(
        createIssue({
          severity: 'critical',
          resourceType: 'Pod',
          resourceName: podName,
          namespace,
          reason: pod.status?.reason || 'Failed',
          message: pod.status?.message || `Pod ${namespace}/${podName} has failed`,
          recommendation:
            'Review pod events and container logs. Fix the underlying application or configuration issue.',
        })
      );
    }

    for (const cs of containerStatuses) {
      const waitingReason = getContainerWaitingReason(cs);
      const terminatedReason = getContainerTerminatedReason(cs);
      const lastTerminatedReason = getContainerLastTerminatedReason(cs);

      if (waitingReason === 'CrashLoopBackOff') {
        issues.push(
          createIssue({
            severity: 'critical',
            resourceType: 'Pod',
            resourceName: podName,
            namespace,
            reason: 'CrashLoopBackOff',
            message: `Container ${cs.name} in pod ${namespace}/${podName} is in CrashLoopBackOff`,
            recommendation:
              'Inspect container logs and previous container logs. Fix application crashes or misconfiguration.',
          })
        );
      }

      if (['ImagePullBackOff', 'ErrImagePull'].includes(waitingReason)) {
        issues.push(
          createIssue({
            severity: 'critical',
            resourceType: 'Pod',
            resourceName: podName,
            namespace,
            reason: waitingReason,
            message: `Container ${cs.name} in pod ${namespace}/${podName} cannot pull its image`,
            recommendation:
              'Verify image name/tag, registry credentials, and network access to the container registry.',
          })
        );
      }

      if (terminatedReason === 'OOMKilled' || lastTerminatedReason === 'OOMKilled') {
        issues.push(
          createIssue({
            severity: 'critical',
            resourceType: 'Pod',
            resourceName: podName,
            namespace,
            reason: 'OOMKilled',
            message: `Container ${cs.name} in pod ${namespace}/${podName} was OOMKilled`,
            recommendation:
              'Increase memory limits/requests or optimize application memory usage.',
          })
        );
      }

      if ((cs.restartCount || 0) >= FREQUENT_RESTART_THRESHOLD) {
        issues.push(
          createIssue({
            severity: 'warning',
            resourceType: 'Pod',
            resourceName: podName,
            namespace,
            reason: 'FrequentRestarts',
            message: `Container ${cs.name} in pod ${namespace}/${podName} has restarted ${cs.restartCount} times`,
            recommendation:
              'Review recent logs and liveness/readiness probe configuration for instability.',
          })
        );
      }
    }

    const totalRestarts = getPodRestartCount(pod);
    if (totalRestarts >= FREQUENT_RESTART_THRESHOLD && phase === 'Running') {
      const alreadyReported = issues.some(
        (issue) =>
          issue.resourceType === 'Pod' &&
          issue.resourceName === podName &&
          issue.namespace === namespace &&
          issue.reason === 'FrequentRestarts'
      );

      if (!alreadyReported) {
        issues.push(
          createIssue({
            severity: 'warning',
            resourceType: 'Pod',
            resourceName: podName,
            namespace,
            reason: 'FrequentRestarts',
            message: `Pod ${namespace}/${podName} has ${totalRestarts} total container restarts`,
            recommendation:
              'Investigate container stability and resource constraints.',
          })
        );
      }
    }
  }

  for (const deployment of deployments) {
    const name = deployment.metadata.name;
    const namespace = deployment.metadata.namespace;
    const desired = deployment.spec?.replicas ?? 0;
    const available = deployment.status?.availableReplicas ?? 0;
    const unavailable = deployment.status?.unavailableReplicas ?? 0;

    if (desired > 0 && available < desired) {
      issues.push(
        createIssue({
          severity: unavailable > 0 ? 'critical' : 'warning',
          resourceType: 'Deployment',
          resourceName: name,
          namespace,
          reason: 'UnavailableReplicas',
          message: `Deployment ${namespace}/${name} has ${available}/${desired} available replicas`,
          recommendation:
            'Check related ReplicaSets and Pods for scheduling, image pull, or crash issues.',
        })
      );
    }
  }

  return issues;
}

function calculateHealthScore(issues) {
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  const penalty = criticalCount * 15 + warningCount * 5;
  return Math.max(0, Math.min(100, 100 - penalty));
}

function determineHealthStatus(score, issues) {
  const hasCritical = issues.some((i) => i.severity === 'critical');
  if (hasCritical || score < 50) return 'critical';
  if (score < 80 || issues.some((i) => i.severity === 'warning')) return 'warning';
  return 'healthy';
}

async function getClusterHealth(clients) {
  const issues = await collectClusterIssues(clients);
  const score = calculateHealthScore(issues);
  const status = determineHealthStatus(score, issues);

  return {
    score,
    status,
    issues,
  };
}

async function getTroubleshootingReport(clients) {
  const issues = await collectClusterIssues(clients);

  return {
    critical: issues.filter((i) => i.severity === 'critical'),
    warning: issues.filter((i) => i.severity === 'warning'),
    info: issues.filter((i) => i.severity === 'info'),
  };
}

module.exports = {
  getClusterHealth,
  getTroubleshootingReport,
  collectClusterIssues,
};
