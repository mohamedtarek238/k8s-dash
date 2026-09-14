const express = require('express');
const gatewayController = require('../controllers/gateway.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  nameParamSchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', asyncHandler(gatewayController.getGatewayClasses));
router.get(
  '/:name/yaml',
  validate(nameParamSchema, 'params'),
  asyncHandler(gatewayController.getGatewayClassYaml)
);
router.get(
  '/:name',
  validate(nameParamSchema, 'params'),
  asyncHandler(gatewayController.getGatewayClassDetails)
);

module.exports = router;
