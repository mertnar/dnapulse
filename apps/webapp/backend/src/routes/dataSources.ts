import express from 'express';
import { dataSourcesController } from '../controllers/dataSourcesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', dataSourcesController.getDataSources);
router.get('/:id', dataSourcesController.getDataSourceById);
router.post('/', dataSourcesController.createDataSource);
router.put('/:id', dataSourcesController.updateDataSource);
router.delete('/:id', dataSourcesController.deleteDataSource);
router.post('/:id/test-connection', dataSourcesController.testConnection);
router.post('/:id/discovery', dataSourcesController.runDiscovery);
router.get('/:id/model', dataSourcesController.getDataModel);
router.get('/:id/sample-events', dataSourcesController.getSampleEvents);
router.get('/:id/schema-changes', dataSourcesController.getSchemaChanges);
router.post('/:id/schema-changes/accept', dataSourcesController.acceptSchemaChanges);
router.get('/:id/errors', dataSourcesController.getErrors);
router.get('/:id/audit-logs', dataSourcesController.getAuditLogs);
router.post('/:id/test-event', dataSourcesController.sendTestEvent);
router.post('/:id/simulate-drift', dataSourcesController.simulateDrift);

export default router;
