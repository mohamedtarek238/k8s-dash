const express = require('express');
const crdsController = require('../controllers/crds.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(crdsController.getOperatorsSummary));

module.exports = router;
