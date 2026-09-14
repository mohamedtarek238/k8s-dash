const express = require('express');
const statefulSetsController = require('../controllers/statefulsets.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  namespaceQuerySchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(statefulSetsController.getStatefulSets));
router.get(
  '/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(statefulSetsController.getStatefulSetYaml)
);
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema),
  asyncHandler(statefulSetsController.getStatefulSetDetails)
);

module.exports = router;


