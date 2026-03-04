import express from 'express';
import { apiKeysController } from '../controllers/apiKeysController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Protect all API key routes
router.use(authMiddleware);

// GET /api/api-keys - List all API keys
router.get('/', apiKeysController.getAll);

// GET /api/api-keys/:id - Get API key details
router.get('/:id', apiKeysController.getById);

// POST /api/api-keys - Create new API key
router.post('/', apiKeysController.create);

// PUT /api/api-keys/:id - Update API key
router.put('/:id', apiKeysController.update);

// DELETE /api/api-keys/:id - Delete API key
router.delete('/:id', apiKeysController.delete);

export default router;
