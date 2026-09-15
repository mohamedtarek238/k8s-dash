const storageService = require('../services/kubernetes/storage.service');
const yamlService = require('../services/kubernetes/yaml.service');
const { sendSuccess, sendList } = require('../utils/response');

async function getStorageOverview(req, res) {
  const data = await storageService.getStorageOverview(req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Persistent Volumes
// ---------------------------------------------------------------------------

async function getPersistentVolumes(req, res) {
  const { search } = req.validatedQuery || {};
  let data = await storageService.listPersistentVolumes(req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (pv) =>
        pv.name.toLowerCase().includes(q) ||
        pv.storageClass.toLowerCase().includes(q) ||
        (pv.claim && pv.claim.toLowerCase().includes(q)) ||
        pv.status.toLowerCase().includes(q)
    );
  }

  return sendList(res, data, { total: data.length });
}

async function getPersistentVolumeDetails(req, res) {
  const { name } = req.validatedParams;
  const { includeEvents } = req.validatedQuery || {};
  const data = await storageService.getPersistentVolumeDetails(name, req.k8sClients, { includeEvents });
  return sendSuccess(res, data);
}

async function getPersistentVolumeYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('pv', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Persistent Volume Claims
// ---------------------------------------------------------------------------

async function getPersistentVolumeClaims(req, res) {
  const { namespace, search } = req.validatedQuery || {};
  let data = await storageService.listPersistentVolumeClaims(namespace, req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (pvc) =>
        pvc.name.toLowerCase().includes(q) ||
        pvc.namespace.toLowerCase().includes(q) ||
        pvc.storageClass.toLowerCase().includes(q) ||
        (pvc.volumeName && pvc.volumeName.toLowerCase().includes(q)) ||
        pvc.status.toLowerCase().includes(q)
    );
  }

  return sendList(res, data, {
    total: data.length,
    ...(namespace ? { namespace } : {}),
  });
}

async function getPersistentVolumeClaimDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const { includeEvents } = req.validatedQuery || {};
  const data = await storageService.getPersistentVolumeClaimDetails(namespace, name, req.k8sClients, { includeEvents });
  return sendSuccess(res, data);
}

async function getPersistentVolumeClaimYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('pvc', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Storage Classes
// ---------------------------------------------------------------------------

async function getStorageClasses(req, res) {
  const { search } = req.validatedQuery || {};
  let data = await storageService.listStorageClasses(req.k8sClients);

  if (search) {
    const q = search.toLowerCase();
    data = data.filter(
      (sc) =>
        sc.name.toLowerCase().includes(q) ||
        sc.provisioner.toLowerCase().includes(q) ||
        sc.reclaimPolicy.toLowerCase().includes(q)
    );
  }

  return sendList(res, data, { total: data.length });
}

async function getStorageClassDetails(req, res) {
  const { name } = req.validatedParams;
  const data = await storageService.getStorageClassDetails(name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getStorageClassYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('sc', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// CSI Drivers
// ---------------------------------------------------------------------------

async function getCSIDrivers(req, res) {
  const data = await storageService.listCSIDrivers(req.k8sClients);
  return sendList(res, data, { total: data.length });
}

async function getCSIDriverDetails(req, res) {
  const { name } = req.validatedParams;
  const data = await storageService.getCSIDriverDetails(name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getCSIDriverYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('csidriver', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Volume Snapshots
// ---------------------------------------------------------------------------

async function getVolumeSnapshots(req, res) {
  const { namespace } = req.validatedQuery || {};
  const data = await storageService.listVolumeSnapshots(namespace, req.k8sClients);
  return sendSuccess(res, data);
}

async function getVolumeSnapshotDetails(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await storageService.getVolumeSnapshotDetails(namespace, name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getVolumeSnapshotYaml(req, res) {
  const { namespace, name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('volumesnapshot', { namespace, name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Volume Snapshot Classes
// ---------------------------------------------------------------------------

async function getVolumeSnapshotClasses(req, res) {
  const data = await storageService.listVolumeSnapshotClasses(req.k8sClients);
  return sendSuccess(res, data);
}

async function getVolumeSnapshotClassDetails(req, res) {
  const { name } = req.validatedParams;
  const data = await storageService.getVolumeSnapshotClassDetails(name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getVolumeSnapshotClassYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('volumesnapshotclass', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

// ---------------------------------------------------------------------------
// Volume Snapshot Contents
// ---------------------------------------------------------------------------

async function getVolumeSnapshotContents(req, res) {
  const data = await storageService.listVolumeSnapshotContents(req.k8sClients);
  return sendSuccess(res, data);
}

async function getVolumeSnapshotContentDetails(req, res) {
  const { name } = req.validatedParams;
  const data = await storageService.getVolumeSnapshotContentDetails(name, req.k8sClients);
  return sendSuccess(res, data);
}

async function getVolumeSnapshotContentYaml(req, res) {
  const { name } = req.validatedParams;
  const data = await yamlService.getResourceYaml('volumesnapshotcontent', { name }, req.k8sClients);
  return sendSuccess(res, data);
}

module.exports = {
  getStorageOverview,
  getPersistentVolumes,
  getPersistentVolumeDetails,
  getPersistentVolumeYaml,
  getPersistentVolumeClaims,
  getPersistentVolumeClaimDetails,
  getPersistentVolumeClaimYaml,
  getStorageClasses,
  getStorageClassDetails,
  getStorageClassYaml,
  getCSIDrivers,
  getCSIDriverDetails,
  getCSIDriverYaml,
  getVolumeSnapshots,
  getVolumeSnapshotDetails,
  getVolumeSnapshotYaml,
  getVolumeSnapshotClasses,
  getVolumeSnapshotClassDetails,
  getVolumeSnapshotClassYaml,
  getVolumeSnapshotContents,
  getVolumeSnapshotContentDetails,
  getVolumeSnapshotContentYaml,
};
