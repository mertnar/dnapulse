import express from 'express';
import { liveMonitorController } from '../controllers/liveMonitorController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// Search and aggregation
router.post('/search', liveMonitorController.search);
router.post('/agg', liveMonitorController.aggregation);

// Fields and facets
router.get('/fields', liveMonitorController.getFields);
router.post('/facet', liveMonitorController.facet);

// Real-time streaming
router.get('/stream', liveMonitorController.stream);

// Event details
router.get('/events/:id', liveMonitorController.getEventById);

// Stats
router.get('/stats', liveMonitorController.getStats);

// Saved views
router.post('/views', liveMonitorController.createView);
router.get('/views', liveMonitorController.listViews);
router.get('/views/:id', liveMonitorController.getView);
router.put('/views/:id', liveMonitorController.updateView);
router.delete('/views/:id', liveMonitorController.deleteView);

// Legacy endpoints (for backward compatibility)
router.get('/events', liveMonitorController.getEvents);
router.get('/histogram', liveMonitorController.getHistogram);
router.get('/field/:name', liveMonitorController.getFieldInfo);
router.post('/search', liveMonitorController.searchEvents);

export default router;
