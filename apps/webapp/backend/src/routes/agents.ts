import express from 'express';
import { agentsController } from '../controllers/agentsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', agentsController.getAgents);
router.get('/:id', agentsController.getAgent);
router.post('/', agentsController.createAgent);
router.put('/:id', agentsController.updateAgent);
router.delete('/:id', agentsController.deleteAgent);
router.post('/:id/regenerate-token', agentsController.regenerateToken);
router.get('/:id/logs', agentsController.getAgentLogs);
router.get('/:id/events', agentsController.getRecentEvents);

export default router;
