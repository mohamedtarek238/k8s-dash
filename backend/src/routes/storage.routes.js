const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storage.controller');
const {
  validate,
  storageQuerySchema,
  nameParamSchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
} = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');

// Overview
router.get('/overview', asyncHandler(storageController.getStorageOverview));

// Persistent Volumes
router.get(
  '/persistentvolumes',
  validate(storageQuerySchema, 'query'),
  asyncHandler(storageController.getPersistentVolumes)
);
router.get(
  '/persistentvolumes/:name',
  validate(nameParamSchema, 'params'),
  validate(detailQuerySchema, 'query'),
  asyncHandler(storageController.getPersistentVolumeDetails)
);
router.get(
  '/persistentvolumes/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getPersistentVolumeYaml)
);

// Persistent Volume Claims
router.get(
  '/persistentvolumeclaims',
  validate(storageQuerySchema, 'query'),
  asyncHandler(storageController.getPersistentVolumeClaims)
);
router.get(
  '/persistentvolumeclaims/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema, 'query'),
  asyncHandler(storageController.getPersistentVolumeClaimDetails)
);
router.get(
  '/persistentvolumeclaims/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(storageController.getPersistentVolumeClaimYaml)
);

// Storage Classes
router.get(
  '/storageclasses',
  validate(storageQuerySchema, 'query'),
  asyncHandler(storageController.getStorageClasses)
);
router.get(
  '/storageclasses/:name',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getStorageClassDetails)
);
router.get(
  '/storageclasses/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getStorageClassYaml)
);

// CSI Drivers
router.get('/csidrivers', asyncHandler(storageController.getCSIDrivers));
router.get(
  '/csidrivers/:name',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getCSIDriverDetails)
);
router.get(
  '/csidrivers/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getCSIDriverYaml)
);

// Volume Snapshots
router.get(
  '/volumesnapshots',
  validate(storageQuerySchema, 'query'),
  asyncHandler(storageController.getVolumeSnapshots)
);
router.get(
  '/volumesnapshots/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(storageController.getVolumeSnapshotDetails)
);
router.get(
  '/volumesnapshots/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(storageController.getVolumeSnapshotYaml)
);

// Volume Snapshot Classes
router.get('/volumesnapshotclasses', asyncHandler(storageController.getVolumeSnapshotClasses));
router.get(
  '/volumesnapshotclasses/:name',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getVolumeSnapshotClassDetails)
);
router.get(
  '/volumesnapshotclasses/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getVolumeSnapshotClassYaml)
);

// Volume Snapshot Contents
router.get('/volumesnapshotcontents', asyncHandler(storageController.getVolumeSnapshotContents));
router.get(
  '/volumesnapshotcontents/:name',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getVolumeSnapshotContentDetails)
);
router.get(
  '/volumesnapshotcontents/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(storageController.getVolumeSnapshotContentYaml)
);

module.exports = router;
