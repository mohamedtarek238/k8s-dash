const express = require('express');
const metricsController = require('../controllers/metrics.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/overview', asyncHandler(metricsController.getClusterMetrics));
router.get('/', asyncHandler(metricsController.getClusterMetrics));

module.exports = router;
