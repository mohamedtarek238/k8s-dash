const express = require('express');
const troubleshootingController = require('../controllers/troubleshooting.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(troubleshootingController.getTroubleshooting));

module.exports = router;
