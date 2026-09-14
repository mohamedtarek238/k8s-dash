const express = require('express');
const clusterController = require('../controllers/cluster.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(clusterController.getCluster));

module.exports = router;
