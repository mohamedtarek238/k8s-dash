const express = require('express');
const eventsController = require('../controllers/events.controller');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate, namespaceQuerySchema } = require('../middleware/validate');

const router = express.Router();

router.get('/', validate(namespaceQuerySchema), asyncHandler(eventsController.getEvents));

module.exports = router;
