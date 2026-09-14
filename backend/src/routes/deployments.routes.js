const express = require('express');
const deploymentsController = require('../controllers/deployments.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema, deploymentParamsSchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(deploymentsController.getDeployments));
router.get(
  '/:namespace/:name/yaml',
  validate(deploymentParamsSchema, 'params'),
  asyncHandler(deploymentsController.getDeploymentYaml)
);
router.get(
  '/:namespace/:name',
  validate(deploymentParamsSchema, 'params'),
  asyncHandler(deploymentsController.getDeploymentDetails)
);

module.exports = router;

