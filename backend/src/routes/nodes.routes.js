const express = require('express');
const nodesController = require('../controllers/nodes.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(nodesController.getNodes));

module.exports = router;
