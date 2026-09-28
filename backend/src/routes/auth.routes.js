const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.post('/login', asyncHandler(authController.login));
router.get('/me', authenticateToken, asyncHandler(authController.me));

module.exports = router;
