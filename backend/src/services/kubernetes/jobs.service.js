const { getResponseBody } = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');

function formatJobDuration(startTime, completionTime) {
  if (!startTime) return null;
  const start = new Date(startTime).getTime();
  const end = completionTime ? new Date(completionTime).getTime() : Date.now();
  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));

  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function getJobStatus(job) {
  const conditions = job.status?.conditions || [];
  const completeCond = conditions.find((c) => c.type === 'Complete');
  const failedCond = conditions.find((c) => c.type === 'Failed');
  const suspendedCond = conditions.find((c) => c.type === 'Suspended');

  if (completeCond?.status === 'True') return 'Succeeded';
  if (failedCond?.status === 'True') return 'Failed';
  if (suspendedCond?.status === 'True') return 'Suspended';

  if ((job.status?.active ?? 0) > 0) return 'Running';
  if ((job.status?.succeeded ?? 0) > 0 && !job.status?.active) return 'Succeeded';
  if ((job.status?.failed ?? 0) > 0 && !job.status?.active) return 'Failed';

  return 'Pending';
}

function mapJobSummary(job) {
  const status = job.status || {};
  const spec = job.spec || {};
  const metadata = job.metadata || {};

  return {
    name: metadata.name,
    namespace: metadata.namespace,
    uid: metadata.uid,
    labels: metadata.labels || {},
    annotations: metadata.annotations || {},
    status: getJobStatus(job),
    active: status.active ?? 0,
    succeeded: status.succeeded ?? 0,
    failed: status.failed ?? 0,
    completions: spec.completions ?? 1,
    parallelism: spec.parallelism ?? 1,
    backoffLimit: spec.backoffLimit ?? 6,
    startTime: status.startTime || null,
    completionTime: status.completionTime || null,
    duration: formatJobDuration(status.startTime, status.completionTime),
    creationTimestamp: metadata.creationTimestamp,
    ownerReferences: metadata.ownerReferences || [],
    conditions: status.conditions || [],
  };
}

function mapJobPodSummary(pod) {
  const restartCount = (pod.status?.containerStatuses || []).reduce(
    (acc, c) => acc + (c.restartCount || 0),
    0
  );

  return {
    name: pod.metadata?.name || 'unknown',
    namespace: pod.metadata?.namespace || 'default',
    status: pod.status?.phase || 'Unknown',
    phase: pod.status?.phase || 'Unknown',
    nodeName: pod.spec?.nodeName || null,
    podIP: pod.status?.podIP || null,
    restartCount,
    creationTimestamp: pod.metadata?.creationTimestamp || null,
    containerStatuses: (pod.status?.containerStatuses || []).map((c) => ({
      name: c.name,
      ready: Boolean(c.ready),
      restartCount: c.restartCount || 0,
      state: c.state || {},
    })),
  };
}

function mapJobDetails(job, pods = [], events = []) {
  return {
    metadata: {
      name: job.metadata.name,
      namespace: job.metadata.namespace,
      uid: job.metadata.uid,
      labels: job.metadata.labels || {},
      annotations: job.metadata.annotations || {},
      creationTimestamp: job.metadata.creationTimestamp,
      ownerReferences: job.metadata.ownerReferences || [],
    },
    spec: {
      completions: job.spec?.completions ?? 1,
      parallelism: job.spec?.parallelism ?? 1,
      backoffLimit: job.spec?.backoffLimit ?? 6,
      activeDeadlineSeconds: job.spec?.activeDeadlineSeconds || null,
      selector: job.spec?.selector || null,
      template: job.spec?.template || {},
    },
    status: job.status || {},
    summary: mapJobSummary(job),
    duration: formatJobDuration(job.status?.startTime, job.status?.completionTime),
    pods: pods.map(mapJobPodSummary),
    events: events || [],
  };
}

async function listJobs(namespace, clients) {
  const { batchV1Api } = clients;

  const response = namespace
    ? await batchV1Api.listNamespacedJob({ namespace })
    : await batchV1Api.listJobForAllNamespaces();

  const items = getResponseBody(response).items || response.items || [];
  return items.map(mapJobSummary);
}

async function getJobDetails(namespace, name, clients) {
  const { batchV1Api, coreV1Api } = clients;

  const jobResponse = await batchV1Api.readNamespacedJob({ name, namespace });
  const job = getResponseBody(jobResponse) || jobResponse;

  // Resolve related pods created by this Job
  let relatedPods = [];
  try {
    const podResponse = await coreV1Api.listNamespacedPod({
      namespace,
      labelSelector: `job-name=${name}`,
    });
    const items = getResponseBody(podResponse).items || podResponse.items || [];
    if (items.length > 0) {
      relatedPods = items;
    } else {
      // Fallback to checking ownerReferences across namespace pods
      const allPodsResponse = await coreV1Api.listNamespacedPod({ namespace });
      const allItems = getResponseBody(allPodsResponse).items || allPodsResponse.items || [];
      relatedPods = allItems.filter((p) =>
        p.metadata?.ownerReferences?.some(
          (o) => o.kind === 'Job' && (o.name === name || (job.metadata?.uid && o.uid === job.metadata.uid))
        )
      );
    }
  } catch (_) {
    // If pod lookup fails, continue with empty list
    relatedPods = [];
  }

  // Resolve related events
  let events = [];
  try {
    events = await getResourceEvents(
      { kind: 'Job', namespace, name, uid: job.metadata?.uid },
      clients
    );
  } catch (_) {
    events = [];
  }

  return mapJobDetails(job, relatedPods, events);
}

module.exports = {
  formatJobDuration,
  getJobStatus,
  mapJobSummary,
  mapJobPodSummary,
  mapJobDetails,
  listJobs,
  getJobDetails,
};
