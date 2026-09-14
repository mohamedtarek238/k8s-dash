const express = require('express');
const namespacesController = require('../controllers/namespaces.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, nameParamSchema, detailQuerySchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', asyncHandler(namespacesController.getNamespaces));
router.get(
  '/:name',
  validate(nameParamSchema, 'params'),
  validate(detailQuerySchema),
  asyncHandler(namespacesController.getNamespaceDetails)
);

module.exports = router;

