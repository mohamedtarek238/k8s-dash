const express = require('express');
const auditController = require('../controllers/audit.controller');
const { validate, auditQuerySchema } = require('../middleware/validate');
const { asyncHandler } = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', validate(auditQuerySchema), asyncHandler(auditController.getAuditEvents));
router.get('/status', asyncHandler(auditController.getAuditStatus));
router.get('/events', validate(auditQuerySchema), asyncHandler(auditController.getAuditEvents));

module.exports = router;
