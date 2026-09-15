const {
  getPodRestartCount,
  getResponseBody,
  getPodReadiness,
  mapContainerStatuses,
  mapContainers,
  sortEventsByRecency,
  involvedObjectToString,
} = require('../../utils/k8sHelpers');

function mapPodSummary(pod) {
  const readiness = getPodReadiness(pod);

  return {
    name: pod.metadata?.name || 'unknown',
    namespace: pod.metadata?.namespace || 'default',
    status: pod.status?.phase || 'Unknown',
    phase: pod.status?.phase || 'Unknown',
    podIP: pod.status?.podIP || null,
    nodeName: pod.spec?.nodeName || null,
    creationTimestamp: pod.metadata?.creationTimestamp || null,
    restartCount: getPodRestartCount(pod),
    containers: mapContainers(pod.spec?.containers || []),
    containerStatuses: mapContainerStatuses(pod.status?.containerStatuses || []),
    readiness,
    reason: pod.status?.reason || null,
    message: pod.status?.message || null,
  };
}


function formatPodVolumes(pod) {
  const volumes = pod.spec?.volumes || [];
  const containers = [...(pod.spec?.containers || []), ...(pod.spec?.initContainers || [])];

  return volumes.map((v) => {
    let type = 'other';
    let reference = null;

    if (v.persistentVolumeClaim) {
      type = 'persistentVolumeClaim';
      reference = v.persistentVolumeClaim.claimName;
    } else if (v.configMap) {
      type = 'configMap';
      reference = v.configMap.name;
    } else if (v.secret) {
      type = 'secret';
      reference = v.secret.secretName;
    } else if (v.emptyDir) {
      type = 'emptyDir';
      reference = v.emptyDir.medium || 'disk';
    } else if (v.hostPath) {
      type = 'hostPath';
      reference = v.hostPath.path;
    } else if (v.csi) {
      type = 'csi';
      reference = v.csi.driver;
    } else if (v.projected) {
      type = 'projected';
      reference = 'projected';
    } else if (v.nfs) {
      type = 'nfs';
      reference = `${v.nfs.server}:${v.nfs.path}`;
    }

    const mounts = [];
    containers.forEach((c) => {
      (c.volumeMounts || []).forEach((vm) => {
        if (vm.name === v.name) {
          mounts.push({
            container: c.name,
            mountPath: vm.mountPath,
            readOnly: Boolean(vm.readOnly),
            subPath: vm.subPath || null,
          });
        }
      });
    });

    return {
      name: v.name,
      type,
      reference,
      pvcName: v.persistentVolumeClaim?.claimName || null,
      readOnly: Boolean(v.persistentVolumeClaim?.readOnly),
      mounts,
    };
  });
}

function mapPodDetails(pod, events = []) {
  return {
    metadata: {
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      uid: pod.metadata.uid,
      labels: pod.metadata.labels || {},
      annotations: pod.metadata.annotations || {},
      creationTimestamp: pod.metadata.creationTimestamp,
    },
    spec: {
      nodeName: pod.spec?.nodeName,
      restartPolicy: pod.spec?.restartPolicy,
      serviceAccountName: pod.spec?.serviceAccountName,
      containers: pod.spec?.containers || [],
      initContainers: pod.spec?.initContainers || [],
      volumes: pod.spec?.volumes || [],
    },
    status: pod.status,
    containers: mapContainers(pod.spec?.containers || []),
    containerStatuses: mapContainerStatuses(pod.status?.containerStatuses || []),
    restartCount: getPodRestartCount(pod),
    node: pod.spec?.nodeName || null,
    ip: pod.status?.podIP || null,
    volumes: formatPodVolumes(pod),
    conditions: pod.status?.conditions || [],
    events: events.map((event) => ({
      namespace: event.metadata.namespace,
      name: event.metadata.name,
      type: event.type,
      reason: event.reason,
      message: event.message,
      involvedObject: involvedObjectToString(event.involvedObject),
      source: event.source,
      firstTimestamp: event.firstTimestamp,
      lastTimestamp: event.lastTimestamp,
      count: event.count,
    })),
  };
}

async function listPods(namespace, clients) {
  const { coreV1Api } = clients;

  const response = namespace
    ? await coreV1Api.listNamespacedPod({ namespace })
    : await coreV1Api.listPodForAllNamespaces();

  return (getResponseBody(response).items || []).map(mapPodSummary);
}

async function getPodDetails(namespace, podName, clients) {
  const { coreV1Api } = clients;

  const [podResponse, eventsResponse] = await Promise.all([
    coreV1Api.readNamespacedPod({ name: podName, namespace }),
    coreV1Api.listNamespacedEvent({ namespace }),
  ]);

  const pod = getResponseBody(podResponse);
  const podEvents = (getResponseBody(eventsResponse).items || []).filter(
    (event) =>
      event.involvedObject?.kind === 'Pod' &&
      event.involvedObject?.name === podName &&
      event.involvedObject?.namespace === namespace
  );

  return mapPodDetails(pod, sortEventsByRecency(podEvents));
}

async function getPodLogs(namespace, podName, options = {}, clients) {
  const { coreV1Api } = clients;

  const response = await coreV1Api.readNamespacedPodLog({
    name: podName,
    namespace,
    container: options.container,
    tailLines: options.tailLines,
    previous: options.previous || false,
  });

  return {
    namespace,
    podName,
    container: options.container || null,
    tailLines: options.tailLines || null,
    previous: options.previous || false,
    logs: typeof response === 'string' ? response : getResponseBody(response),
  };
}

module.exports = {
  listPods,
  getPodDetails,
  getPodLogs,
};
