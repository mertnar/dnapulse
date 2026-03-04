import express from 'express';
import { agentInstancesController } from '../controllers/agentInstancesController.js';

const router = express.Router();

// Get all agent instances (grouped by agent definition)
router.get('/', agentInstancesController.getAllInstances);

// Get instances for a specific agent
router.get('/by-agent/:agentId', agentInstancesController.getInstancesByAgent);

// Get single instance
router.get('/:instanceId', agentInstancesController.getInstance);

// Update instance config
router.put('/:instanceId/config', agentInstancesController.updateConfig);

// Send command to instance (restart, stop, etc.)
router.post('/:instanceId/command', agentInstancesController.sendCommand);

// Get instance logs
router.get('/:instanceId/logs', agentInstancesController.getLogs);

// Get instance metrics
router.get('/:instanceId/metrics', agentInstancesController.getMetrics);

export default router;
