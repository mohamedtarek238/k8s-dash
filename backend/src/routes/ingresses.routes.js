const express = require('express');
const ingressesController = require('../controllers/ingresses.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(ingressesController.getIngresses));

module.exports = router;
