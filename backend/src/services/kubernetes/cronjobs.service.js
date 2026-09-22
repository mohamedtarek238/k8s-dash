const { getResponseBody } = require('../../utils/k8sHelpers');
const { getResourceEvents } = require('./events.service');
const { mapJobSummary } = require('./jobs.service');

function mapCronJobSummary(cronJob) {
  const metadata = cronJob.metadata || {};
  const spec = cronJob.spec || {};
  const status = cronJob.status || {};
  const isSuspended = Boolean(spec.suspend);

  return {
    name: metadata.name,
    namespace: metadata.namespace,
    uid: metadata.uid,
    schedule: spec.schedule || '—',
    timeZone: spec.timeZone || null,
    suspend: isSuspended,
    concurrencyPolicy: spec.concurrencyPolicy || 'Allow',
    activeJobsCount: (status.active || []).length,
    lastScheduleTime: status.lastScheduleTime || null,
    lastSuccessfulTime: status.lastSuccessfulTime || null,
    status: isSuspended ? 'Suspended' : 'Active',
    creationTimestamp: metadata.creationTimestamp,
    labels: metadata.labels || {},
    annotations: metadata.annotations || {},
    ownerReferences: metadata.ownerReferences || [],
  };
}

function mapCronJobDetails(cronJob, recentJobs = [], events = []) {
  const metadata = cronJob.metadata || {};
  const spec = cronJob.spec || {};
  const status = cronJob.status || {};

  return {
    metadata: {
      name: metadata.name,
      namespace: metadata.namespace,
      uid: metadata.uid,
      labels: metadata.labels || {},
      annotations: metadata.annotations || {},
      creationTimestamp: metadata.creationTimestamp,
      ownerReferences: metadata.ownerReferences || [],
    },
    spec: {
      schedule: spec.schedule || '—',
      timeZone: spec.timeZone || null,
      suspend: Boolean(spec.suspend),
      concurrencyPolicy: spec.concurrencyPolicy || 'Allow',
      startingDeadlineSeconds: spec.startingDeadlineSeconds || null,
      successfulJobsHistoryLimit: spec.successfulJobsHistoryLimit ?? 3,
      failedJobsHistoryLimit: spec.failedJobsHistoryLimit ?? 1,
      jobTemplate: spec.jobTemplate || {},
    },
    status: {
      active: status.active || [],
      lastScheduleTime: status.lastScheduleTime || null,
      lastSuccessfulTime: status.lastSuccessfulTime || null,
    },
    summary: mapCronJobSummary(cronJob),
    jobs: recentJobs.map(mapJobSummary),
    events: events || [],
  };
}

async function listCronJobs(namespace, clients) {
  const { batchV1Api } = clients;

  const response = namespace
    ? await batchV1Api.listNamespacedCronJob({ namespace })
    : await batchV1Api.listCronJobForAllNamespaces();

  const items = getResponseBody(response).items || response.items || [];
  return items.map(mapCronJobSummary);
}

async function getCronJobDetails(namespace, name, clients) {
  const { batchV1Api } = clients;

  const cronJobResponse = await batchV1Api.readNamespacedCronJob({ name, namespace });
  const cronJob = getResponseBody(cronJobResponse) || cronJobResponse;

  // Resolve recent jobs created by this CronJob using ownerReferences
  let recentJobs = [];
  try {
    const jobListResponse = await batchV1Api.listNamespacedJob({ namespace });
    const items = getResponseBody(jobListResponse).items || jobListResponse.items || [];
    recentJobs = items.filter((j) =>
      j.metadata?.ownerReferences?.some(
        (o) =>
          o.kind === 'CronJob' &&
          (o.name === name || (cronJob.metadata?.uid && o.uid === cronJob.metadata.uid))
      )
    );
    // Sort recent jobs by creationTimestamp descending (newest first)
    recentJobs.sort(
      (a, b) =>
        new Date(b.metadata?.creationTimestamp || 0) -
        new Date(a.metadata?.creationTimestamp || 0)
    );
  } catch (_) {
    recentJobs = [];
  }

  // Resolve related events
  let events = [];
  try {
    events = await getResourceEvents(
      { kind: 'CronJob', namespace, name, uid: cronJob.metadata?.uid },
      clients
    );
  } catch (_) {
    events = [];
  }

  return mapCronJobDetails(cronJob, recentJobs, events);
}

module.exports = {
  mapCronJobSummary,
  mapCronJobDetails,
  listCronJobs,
  getCronJobDetails,
};
