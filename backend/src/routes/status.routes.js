const express = require('express');
const statusController = require('../controllers/status.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(statusController.getStatus));

module.exports = router;
