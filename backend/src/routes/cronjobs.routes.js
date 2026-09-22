const express = require('express');
const cronJobsController = require('../controllers/cronjobs.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema, namespacedNameParamsSchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(cronJobsController.getCronJobs));
router.get(
  '/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(cronJobsController.getCronJobYaml)
);
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(cronJobsController.getCronJobDetails)
);

module.exports = router;
