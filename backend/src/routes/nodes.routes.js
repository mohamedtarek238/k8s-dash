const express = require('express');
const nodesController = require('../controllers/nodes.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, nameParamSchema, detailQuerySchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', asyncHandler(nodesController.getNodes));
router.get(
  '/:name',
  validate(nameParamSchema, 'params'),
  validate(detailQuerySchema),
  asyncHandler(nodesController.getNodeDetails)
);

module.exports = router;

