import express from 'express';
import { detectionController } from '../controllers/detectionController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/search-events', detectionController.searchEvents);
router.post('/agg-events', detectionController.aggregateEvents);

export default router;
