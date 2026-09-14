const express = require('express');
const servicesController = require('../controllers/services.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  namespaceQuerySchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(servicesController.getServices));
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema),
  asyncHandler(servicesController.getServiceDetails)
);

module.exports = router;

