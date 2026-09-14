const express = require('express');
const ingressesController = require('../controllers/ingresses.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  ingressQuerySchema,
  namespacedNameParamsSchema,
  ingressDetailQuerySchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(ingressQuerySchema), asyncHandler(ingressesController.getIngresses));
router.get(
  '/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(ingressesController.getIngressYaml)
);
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(ingressDetailQuerySchema),
  asyncHandler(ingressesController.getIngressDetails)
);

module.exports = router;


