const express = require('express');
const daemonSetsController = require('../controllers/daemonsets.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(daemonSetsController.getDaemonSets));

module.exports = router;
