const express = require('express');
const statefulSetsController = require('../controllers/statefulsets.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(statefulSetsController.getStatefulSets));

module.exports = router;
