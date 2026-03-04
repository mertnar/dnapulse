import express from 'express';
import { auditLogsController } from '../controllers/auditLogsController.js';

const router = express.Router();

router.get('/', auditLogsController.getAuditLogs);
router.get('/:id', auditLogsController.getAuditLogById);
router.get('/user/:userId', auditLogsController.getAuditLogsByUser);
router.get('/action/:action', auditLogsController.getAuditLogsByAction);
router.get('/resource-type/:resourceType', auditLogsController.getAuditLogsByResourceType);
router.get('/date-range/:startDate/:endDate', auditLogsController.getAuditLogsByDateRange);

export default router;
