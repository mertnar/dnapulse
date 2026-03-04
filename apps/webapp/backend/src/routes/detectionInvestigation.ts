import express from 'express';
import { liveMonitorController } from '../controllers/liveMonitorController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Search and aggregation (reuse liveMonitorController as they use the same ELK backend)
router.post('/search', liveMonitorController.search);
router.post('/agg', liveMonitorController.aggregation);

// Fields and facets
router.get('/fields', liveMonitorController.getFields);
router.post('/facet', liveMonitorController.facet);

// Event details
router.get('/events/:id', liveMonitorController.getEventById);

export default router;
