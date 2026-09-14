const express = require('express');
const ingressesController = require('../controllers/ingresses.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  namespaceQuerySchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(ingressesController.getIngresses));
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema),
  asyncHandler(ingressesController.getIngressDetails)
);

module.exports = router;

