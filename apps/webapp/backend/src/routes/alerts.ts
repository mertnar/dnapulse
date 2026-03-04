import express from 'express';
import { alertsController } from '../controllers/alertsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', alertsController.getAlerts);
router.get('/status/:status', alertsController.getAlertsByStatus);
router.get('/severity/:severity', alertsController.getAlertsBySeverity);
router.get('/:id', alertsController.getAlertById);
router.put('/:id/status', alertsController.updateAlertStatus);
router.put('/:id/assign', alertsController.assignAlert);
router.delete('/:id', alertsController.deleteAlert);

// Detection & investigation endpoints
router.patch('/:id/status', alertsController.updateStatus);
router.post('/:id/investigate', alertsController.investigate);

export default router;
