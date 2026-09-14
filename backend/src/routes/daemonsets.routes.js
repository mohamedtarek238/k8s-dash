const express = require('express');
const daemonSetsController = require('../controllers/daemonsets.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  namespaceQuerySchema,
  namespacedNameParamsSchema,
  detailQuerySchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(daemonSetsController.getDaemonSets));
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  validate(detailQuerySchema),
  asyncHandler(daemonSetsController.getDaemonSetDetails)
);

module.exports = router;

