const express = require('express');
const crdsController = require('../controllers/crds.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  customResourceListQuerySchema,
  crdCoordinatesParamsSchema,
  customResourceClusterParamsSchema,
  customResourceNamespacedParamsSchema,
} = require('../middleware/validate');

const router = express.Router();

// List custom resources
router.get(
  '/:group/:version/:plural',
  validate(crdCoordinatesParamsSchema, 'params'),
  validate(customResourceListQuerySchema, 'query'),
  asyncHandler(crdsController.getCustomResources)
);

// Cluster-scoped YAML
router.get(
  '/:group/:version/:plural/:name/yaml',
  validate(customResourceClusterParamsSchema, 'params'),
  asyncHandler(crdsController.getClusterCustomResourceYaml)
);

// Namespaced YAML
router.get(
  '/:group/:version/:plural/:namespace/:name/yaml',
  validate(customResourceNamespacedParamsSchema, 'params'),
  asyncHandler(crdsController.getNamespacedCustomResourceYaml)
);

// Namespaced Custom Resource Details
router.get(
  '/:group/:version/:plural/:namespace/:name',
  validate(customResourceNamespacedParamsSchema, 'params'),
  asyncHandler(crdsController.getNamespacedCustomResourceDetails)
);

// Cluster-scoped Custom Resource Details
router.get(
  '/:group/:version/:plural/:name',
  validate(customResourceClusterParamsSchema, 'params'),
  asyncHandler(crdsController.getClusterCustomResourceDetails)
);

module.exports = router;
