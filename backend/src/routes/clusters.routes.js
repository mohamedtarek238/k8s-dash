const express = require('express');
const clustersController = require('../controllers/clusters.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(clustersController.getClusters));
router.get('/:clusterId', asyncHandler(clustersController.getClusterById));

module.exports = router;
