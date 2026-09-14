const express = require('express');
const namespacesController = require('../controllers/namespaces.controller');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(namespacesController.getNamespaces));

module.exports = router;
