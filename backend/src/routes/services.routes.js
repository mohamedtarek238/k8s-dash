const express = require('express');
const servicesController = require('../controllers/services.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(servicesController.getServices));

module.exports = router;
