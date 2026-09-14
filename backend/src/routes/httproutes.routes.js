const express = require('express');
const gatewayController = require('../controllers/gateway.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  namespaceQuerySchema,
  namespacedNameParamsSchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(gatewayController.getHttpRoutes));
router.get(
  '/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(gatewayController.getHttpRouteYaml)
);
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(gatewayController.getHttpRouteDetails)
);

module.exports = router;
