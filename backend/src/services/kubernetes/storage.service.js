const { getResponseBody, calculateAge } = require('../../utils/k8sHelpers');
const eventsService = require('./events.service');

// ---------------------------------------------------------------------------
// Mapping Helpers
// ---------------------------------------------------------------------------

function extractCSIDriver(pv) {
  if (pv.spec?.csi?.driver) return pv.spec.csi.driver;
  if (pv.spec?.local) return 'local';
  if (pv.spec?.hostPath) return 'hostPath';
  if (pv.spec?.nfs) return 'nfs';
  if (pv.spec?.iscsi) return 'iscsi';
  if (pv.spec?.fc) return 'fc';
  if (pv.spec?.rbd) return 'rbd';
  if (pv.spec?.cephfs) return 'cephfs';
  if (pv.spec?.cinder) return 'cinder';
  if (pv.spec?.glusterfs) return 'glusterfs';
  if (pv.spec?.azureDisk) return 'azureDisk';
  if (pv.spec?.azureFile) return 'azureFile';
  if (pv.spec?.awsElasticBlockStore) return 'awsElasticBlockStore';
  if (pv.spec?.gcePersistentDisk) return 'gcePersistentDisk';
  if (pv.spec?.vsphereVolume) return 'vsphereVolume';
  return 'standard';
}

function mapPVSummary(pv) {
  const claimRef = pv.spec?.claimRef
    ? {
        namespace: pv.spec.claimRef.namespace || 'default',
        name: pv.spec.claimRef.name || '',
      }
    : null;

  return {
    name: pv.metadata?.name || '',
    capacity: pv.spec?.capacity?.storage || '0',
    accessModes: pv.spec?.accessModes || [],
    reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy || 'Retain',
    status: pv.status?.phase || 'Unknown',
    storageClass: pv.spec?.storageClassName || '—',
    claim: claimRef ? `${claimRef.namespace}/${claimRef.name}` : null,
    claimRef,
    volumeMode: pv.spec?.volumeMode || 'Filesystem',
    csiDriver: extractCSIDriver(pv),
    mountOptions: pv.spec?.mountOptions || [],
    creationTimestamp: pv.metadata?.creationTimestamp || null,
    age: calculateAge(pv.metadata?.creationTimestamp),
    labels: pv.metadata?.labels || {},
    annotations: pv.metadata?.annotations || {},
  };
}

function mapPVCSummary(pvc) {
  return {
    name: pvc.metadata?.name || '',
    namespace: pvc.metadata?.namespace || 'default',
    status: pvc.status?.phase || 'Pending',
    volumeName: pvc.spec?.volumeName || null,
    capacity: pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '0',
    requestedStorage: pvc.spec?.resources?.requests?.storage || '0',
    accessModes: pvc.spec?.accessModes || [],
    storageClass:
      pvc.spec?.storageClassName ||
      pvc.metadata?.annotations?.['volume.beta.kubernetes.io/storage-class'] ||
      '—',
    volumeMode: pvc.spec?.volumeMode || 'Filesystem',
    selector: pvc.spec?.selector || null,
    dataSource: pvc.spec?.dataSource || pvc.spec?.dataSourceRef || null,
    creationTimestamp: pvc.metadata?.creationTimestamp || null,
    age: calculateAge(pvc.metadata?.creationTimestamp),
    labels: pvc.metadata?.labels || {},
    annotations: pvc.metadata?.annotations || {},
  };
}

function mapStorageClassSummary(sc) {
  const isDefault =
    sc.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' ||
    sc.metadata?.annotations?.['storageclass.beta.kubernetes.io/is-default-class'] === 'true';

  return {
    name: sc.metadata?.name || '',
    provisioner: sc.provisioner || '—',
    reclaimPolicy: sc.reclaimPolicy || 'Delete',
    volumeBindingMode: sc.volumeBindingMode || 'Immediate',
    allowVolumeExpansion: Boolean(sc.allowVolumeExpansion),
    mountOptions: sc.mountOptions || [],
    parameters: sc.parameters || {},
    allowedTopologies: sc.allowedTopologies || [],
    isDefault,
    creationTimestamp: sc.metadata?.creationTimestamp || null,
    age: calculateAge(sc.metadata?.creationTimestamp),
    labels: sc.metadata?.labels || {},
    annotations: sc.metadata?.annotations || {},
  };
}

function mapCSIDriverSummary(driver) {
  return {
    name: driver.metadata?.name || '',
    attachRequired: driver.spec?.attachRequired !== false,
    podInfoOnMount: Boolean(driver.spec?.podInfoOnMount),
    storageCapacity: Boolean(driver.spec?.storageCapacity),
    fsGroupPolicy: driver.spec?.fsGroupPolicy || 'ReadWriteOnceWithFSType',
    volumeLifecycleModes: driver.spec?.volumeLifecycleModes || ['Persistent'],
    creationTimestamp: driver.metadata?.creationTimestamp || null,
    age: calculateAge(driver.metadata?.creationTimestamp),
    labels: driver.metadata?.labels || {},
    annotations: driver.metadata?.annotations || {},
  };
}

function mapVolumeSnapshotSummary(snap) {
  return {
    name: snap.metadata?.name || '',
    namespace: snap.metadata?.namespace || 'default',
    readyToUse: Boolean(snap.status?.readyToUse),
    restoreSize: snap.status?.restoreSize || null,
    creationTime: snap.status?.creationTime || snap.metadata?.creationTimestamp || null,
    volumeSnapshotClassName: snap.spec?.volumeSnapshotClassName || '—',
    boundVolumeSnapshotContentName: snap.status?.boundVolumeSnapshotContentName || null,
    source: snap.spec?.source || null,
    status: snap.status?.readyToUse ? 'Ready' : (snap.status?.error ? 'Error' : 'Pending'),
    error: snap.status?.error || null,
    age: calculateAge(snap.metadata?.creationTimestamp),
    labels: snap.metadata?.labels || {},
    annotations: snap.metadata?.annotations || {},
  };
}

function mapVolumeSnapshotClassSummary(vsc) {
  return {
    name: vsc.metadata?.name || '',
    driver: vsc.driver || '',
    deletionPolicy: vsc.deletionPolicy || 'Delete',
    parameters: vsc.parameters || {},
    isDefault:
      vsc.metadata?.annotations?.['snapshot.storage.kubernetes.io/is-default-class'] === 'true',
    creationTimestamp: vsc.metadata?.creationTimestamp || null,
    age: calculateAge(vsc.metadata?.creationTimestamp),
    labels: vsc.metadata?.labels || {},
    annotations: vsc.metadata?.annotations || {},
  };
}

function mapVolumeSnapshotContentSummary(vsc) {
  return {
    name: vsc.metadata?.name || '',
    readyToUse: Boolean(vsc.status?.readyToUse),
    restoreSize: vsc.status?.restoreSize || null,
    driver: vsc.spec?.driver || '',
    deletionPolicy: vsc.spec?.deletionPolicy || 'Delete',
    volumeSnapshotClassName: vsc.spec?.volumeSnapshotClassName || '—',
    volumeSnapshotRef: vsc.spec?.volumeSnapshotRef || null,
    sourceVolumeMode: vsc.spec?.sourceVolumeMode || 'Filesystem',
    snapshotHandle: vsc.status?.snapshotHandle || null,
    creationTimestamp: vsc.metadata?.creationTimestamp || null,
    age: calculateAge(vsc.metadata?.creationTimestamp),
    labels: vsc.metadata?.labels || {},
    annotations: vsc.metadata?.annotations || {},
  };
}

// ---------------------------------------------------------------------------
// Storage Services
// ---------------------------------------------------------------------------

async function getStorageOverview(clients) {
  const { coreV1Api, storageV1Api, customObjectsApi } = clients;

  const [pvsRes, pvcsRes, scsRes, csiRes, snapshotCheck] = await Promise.allSettled([
    coreV1Api.listPersistentVolume(),
    coreV1Api.listPersistentVolumeClaimForAllNamespaces(),
    storageV1Api.listStorageClass(),
    storageV1Api.listCSIDriver(),
    customObjectsApi.listClusterCustomObject({
      group: 'snapshot.storage.k8s.io',
      version: 'v1',
      plural: 'volumesnapshots',
    }),
  ]);

  const pvs = pvsRes.status === 'fulfilled' ? (getResponseBody(pvsRes.value).items || []).map(mapPVSummary) : [];
  const pvcs = pvcsRes.status === 'fulfilled' ? (getResponseBody(pvcsRes.value).items || []).map(mapPVCSummary) : [];
  const scs = scsRes.status === 'fulfilled' ? (getResponseBody(scsRes.value).items || []).map(mapStorageClassSummary) : [];
  const csi = csiRes.status === 'fulfilled' ? (getResponseBody(csiRes.value).items || []).map(mapCSIDriverSummary) : [];

  let snapshotsAvailable = false;
  let totalSnapshots = 0;
  if (snapshotCheck.status === 'fulfilled') {
    snapshotsAvailable = true;
    totalSnapshots = (getResponseBody(snapshotCheck.value).items || []).length;
  }

  // Aggregate PV metrics
  const pvMetrics = {
    total: pvs.length,
    bound: pvs.filter((p) => p.status.toLowerCase() === 'bound').length,
    available: pvs.filter((p) => p.status.toLowerCase() === 'available').length,
    released: pvs.filter((p) => p.status.toLowerCase() === 'released').length,
    failed: pvs.filter((p) => p.status.toLowerCase() === 'failed').length,
  };

  // Aggregate PVC metrics
  const pvcMetrics = {
    total: pvcs.length,
    bound: pvcs.filter((p) => p.status.toLowerCase() === 'bound').length,
    pending: pvcs.filter((p) => p.status.toLowerCase() === 'pending').length,
    lost: pvcs.filter((p) => p.status.toLowerCase() === 'lost').length,
  };

  // Default StorageClasses
  const defaultClasses = scs.filter((s) => s.isDefault).map((s) => s.name);

  return {
    persistentVolumes: pvMetrics,
    persistentVolumeClaims: pvcMetrics,
    storageClasses: {
      total: scs.length,
      defaultClasses,
      defaultClass: defaultClasses[0] || null,
    },
    csiDrivers: {
      total: csi.length,
      drivers: csi.map((d) => d.name),
    },
    volumeSnapshots: {
      available: snapshotsAvailable,
      total: totalSnapshots,
    },
  };
}

async function listPersistentVolumes(clients) {
  const { coreV1Api } = clients;
  const res = await coreV1Api.listPersistentVolume();
  const items = getResponseBody(res).items || [];
  return items.map(mapPVSummary);
}

async function getPersistentVolumeDetails(name, clients, { includeRelated = false, includeEvents = false } = {}) {
  const { coreV1Api, storageV1Api } = clients;
  const res = await coreV1Api.readPersistentVolume({ name });
  const raw = getResponseBody(res);
  const summary = mapPVSummary(raw);

  let related = null;
  let events = [];

  if (includeRelated) {
    related = { claim: null, storageClass: null, pods: [] };
    if (summary.claimRef?.name) {
      try {
        const claimRes = await coreV1Api.readNamespacedPersistentVolumeClaim({
          namespace: summary.claimRef.namespace,
          name: summary.claimRef.name,
        });
        related.claim = mapPVCSummary(getResponseBody(claimRes));
      } catch (_e) {}
    }
    if (summary.storageClass && summary.storageClass !== '—') {
      try {
        const scRes = await storageV1Api.readStorageClass({ name: summary.storageClass });
        related.storageClass = mapStorageClassSummary(getResponseBody(scRes));
      } catch (_e) {}
    }
  }

  if (includeEvents) {
    try {
      events = await eventsService.getResourceEvents(
        { kind: 'PersistentVolume', name, uid: raw.metadata?.uid },
        clients
      );
    } catch (_e) {}
  }

  return {
    ...summary,
    spec: raw.spec || {},
    statusRaw: raw.status || {},
    related,
    events,
  };
}

async function listPersistentVolumeClaims(namespace, clients) {
  const { coreV1Api } = clients;
  let res;
  if (namespace) {
    res = await coreV1Api.listNamespacedPersistentVolumeClaim({ namespace });
  } else {
    res = await coreV1Api.listPersistentVolumeClaimForAllNamespaces();
  }
  const items = getResponseBody(res).items || [];
  return items.map(mapPVCSummary);
}

async function getPersistentVolumeClaimDetails(namespace, name, clients, { includeRelated = false, includeEvents = false } = {}) {
  const { coreV1Api, storageV1Api } = clients;
  const res = await coreV1Api.readNamespacedPersistentVolumeClaim({ namespace, name });
  const raw = getResponseBody(res);
  const summary = mapPVCSummary(raw);

  let related = null;
  let events = [];

  if (includeRelated) {
    related = { volume: null, storageClass: null, mountedPods: [] };
    if (summary.volumeName) {
      try {
        const pvRes = await coreV1Api.readPersistentVolume({ name: summary.volumeName });
        related.volume = mapPVSummary(getResponseBody(pvRes));
      } catch (_e) {}
    }
    if (summary.storageClass && summary.storageClass !== '—') {
      try {
        const scRes = await storageV1Api.readStorageClass({ name: summary.storageClass });
        related.storageClass = mapStorageClassSummary(getResponseBody(scRes));
      } catch (_e) {}
    }
    // Find pods mounting this PVC in the same namespace
    try {
      const podsRes = await coreV1Api.listNamespacedPod({ namespace });
      const pods = getResponseBody(podsRes).items || [];
      related.mountedPods = pods
        .filter((pod) =>
          (pod.spec?.volumes || []).some(
            (v) => v.persistentVolumeClaim?.claimName === name
          )
        )
        .map((pod) => ({
          name: pod.metadata?.name,
          namespace: pod.metadata?.namespace,
          phase: pod.status?.phase,
          podIP: pod.status?.podIP,
        }));
    } catch (_e) {}
  }

  if (includeEvents) {
    try {
      events = await eventsService.getResourceEvents(
        { kind: 'PersistentVolumeClaim', namespace, name, uid: raw.metadata?.uid },
        clients
      );
    } catch (_e) {}
  }

  return {
    ...summary,
    spec: raw.spec || {},
    statusRaw: raw.status || {},
    related,
    events,
  };
}

async function listStorageClasses(clients) {
  const { storageV1Api } = clients;
  const res = await storageV1Api.listStorageClass();
  const items = getResponseBody(res).items || [];
  return items.map(mapStorageClassSummary);
}

async function getStorageClassDetails(name, clients, { includeRelated = false } = {}) {
  const { storageV1Api, coreV1Api } = clients;
  const res = await storageV1Api.readStorageClass({ name });
  const raw = getResponseBody(res);
  const summary = mapStorageClassSummary(raw);

  let related = null;
  if (includeRelated) {
    try {
      const [pvsRes, pvcsRes] = await Promise.all([
        coreV1Api.listPersistentVolume(),
        coreV1Api.listPersistentVolumeClaimForAllNamespaces(),
      ]);
      const pvs = (getResponseBody(pvsRes).items || []).filter((p) => p.spec?.storageClassName === name);
      const pvcs = (getResponseBody(pvcsRes).items || []).filter(
        (p) =>
          p.spec?.storageClassName === name ||
          p.metadata?.annotations?.['volume.beta.kubernetes.io/storage-class'] === name
      );

      related = {
        totalPVs: pvs.length,
        totalPVCs: pvcs.length,
        pvs: pvs.map(mapPVSummary),
        pvcs: pvcs.map(mapPVCSummary),
      };
    } catch (_e) {}
  }

  return {
    ...summary,
    parameters: raw.parameters || {},
    allowedTopologies: raw.allowedTopologies || [],
    related,
  };
}

async function listCSIDrivers(clients) {
  const { storageV1Api } = clients;
  const res = await storageV1Api.listCSIDriver();
  const items = getResponseBody(res).items || [];
  return items.map(mapCSIDriverSummary);
}

async function getCSIDriverDetails(name, clients) {
  const { storageV1Api } = clients;
  const res = await storageV1Api.readCSIDriver({ name });
  const raw = getResponseBody(res);
  return {
    ...mapCSIDriverSummary(raw),
    spec: raw.spec || {},
  };
}

// ---------------------------------------------------------------------------
// Volume Snapshots (CRD Safe Fallback)
// ---------------------------------------------------------------------------

async function listVolumeSnapshots(namespace, clients) {
  const { customObjectsApi } = clients;
  try {
    let res;
    if (namespace) {
      res = await customObjectsApi.listNamespacedCustomObject({
        group: 'snapshot.storage.k8s.io',
        version: 'v1',
        namespace,
        plural: 'volumesnapshots',
      });
    } else {
      res = await customObjectsApi.listClusterCustomObject({
        group: 'snapshot.storage.k8s.io',
        version: 'v1',
        plural: 'volumesnapshots',
      });
    }
    const items = getResponseBody(res).items || [];
    return { available: true, items: items.map(mapVolumeSnapshotSummary) };
  } catch (err) {
    if (err.statusCode === 404 || err.code === 404) {
      return { available: false, items: [] };
    }
    throw err;
  }
}

async function getVolumeSnapshotDetails(namespace, name, clients) {
  const { customObjectsApi } = clients;
  const res = await customObjectsApi.getNamespacedCustomObject({
    group: 'snapshot.storage.k8s.io',
    version: 'v1',
    namespace,
    plural: 'volumesnapshots',
    name,
  });
  const raw = getResponseBody(res);
  return {
    ...mapVolumeSnapshotSummary(raw),
    spec: raw.spec || {},
    statusRaw: raw.status || {},
  };
}

async function listVolumeSnapshotClasses(clients) {
  const { customObjectsApi } = clients;
  try {
    const res = await customObjectsApi.listClusterCustomObject({
      group: 'snapshot.storage.k8s.io',
      version: 'v1',
      plural: 'volumesnapshotclasses',
    });
    const items = getResponseBody(res).items || [];
    return { available: true, items: items.map(mapVolumeSnapshotClassSummary) };
  } catch (err) {
    if (err.statusCode === 404 || err.code === 404) {
      return { available: false, items: [] };
    }
    throw err;
  }
}

async function getVolumeSnapshotClassDetails(name, clients) {
  const { customObjectsApi } = clients;
  const res = await customObjectsApi.getClusterCustomObject({
    group: 'snapshot.storage.k8s.io',
    version: 'v1',
    plural: 'volumesnapshotclasses',
    name,
  });
  const raw = getResponseBody(res);
  return {
    ...mapVolumeSnapshotClassSummary(raw),
    parameters: raw.parameters || {},
  };
}

async function listVolumeSnapshotContents(clients) {
  const { customObjectsApi } = clients;
  try {
    const res = await customObjectsApi.listClusterCustomObject({
      group: 'snapshot.storage.k8s.io',
      version: 'v1',
      plural: 'volumesnapshotcontents',
    });
    const items = getResponseBody(res).items || [];
    return { available: true, items: items.map(mapVolumeSnapshotContentSummary) };
  } catch (err) {
    if (err.statusCode === 404 || err.code === 404) {
      return { available: false, items: [] };
    }
    throw err;
  }
}

async function getVolumeSnapshotContentDetails(name, clients) {
  const { customObjectsApi } = clients;
  const res = await customObjectsApi.getClusterCustomObject({
    group: 'snapshot.storage.k8s.io',
    version: 'v1',
    plural: 'volumesnapshotcontents',
    name,
  });
  const raw = getResponseBody(res);
  return {
    ...mapVolumeSnapshotContentSummary(raw),
    spec: raw.spec || {},
    statusRaw: raw.status || {},
  };
}

module.exports = {
  getStorageOverview,
  listPersistentVolumes,
  getPersistentVolumeDetails,
  listPersistentVolumeClaims,
  getPersistentVolumeClaimDetails,
  listStorageClasses,
  getStorageClassDetails,
  listCSIDrivers,
  getCSIDriverDetails,
  listVolumeSnapshots,
  getVolumeSnapshotDetails,
  listVolumeSnapshotClasses,
  getVolumeSnapshotClassDetails,
  listVolumeSnapshotContents,
  getVolumeSnapshotContentDetails,
};
