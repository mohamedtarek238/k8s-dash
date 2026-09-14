const express = require('express');
const resourcesController = require('../controllers/resources.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  genericNamespacedResourceParamsSchema,
  genericClusterResourceParamsSchema,
} = require('../middleware/validate');

const router = express.Router();

router.get(
  '/:resourceType/:namespace/:name/yaml',
  validate(genericNamespacedResourceParamsSchema, 'params'),
  asyncHandler(resourcesController.getNamespacedResourceYaml)
);

router.get(
  '/:resourceType/:name/yaml',
  validate(genericClusterResourceParamsSchema, 'params'),
  asyncHandler(resourcesController.getClusterResourceYaml)
);

module.exports = router;
