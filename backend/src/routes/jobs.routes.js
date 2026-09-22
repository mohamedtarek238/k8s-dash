const express = require('express');
const jobsController = require('../controllers/jobs.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema, namespacedNameParamsSchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(jobsController.getJobs));
router.get(
  '/:namespace/:name/yaml',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(jobsController.getJobYaml)
);
router.get(
  '/:namespace/:name',
  validate(namespacedNameParamsSchema, 'params'),
  asyncHandler(jobsController.getJobDetails)
);

module.exports = router;
