const express = require('express');
const podsController = require('../controllers/pods.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const {
  validate,
  namespaceQuerySchema,
  podParamsSchema,
  podLogsQuerySchema,
} = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(podsController.getPods));
router.get(
  '/:namespace/:podName/logs',
  validate(podParamsSchema, 'params'),
  validate(podLogsQuerySchema),
  asyncHandler(podsController.getPodLogs)
);
router.get(
  '/:namespace/:podName',
  validate(podParamsSchema, 'params'),
  asyncHandler(podsController.getPodDetails)
);

module.exports = router;
