import express from 'express';
import { rulesController } from '../controllers/rulesController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', rulesController.getAll);
router.post('/', rulesController.create);
router.get('/:id', rulesController.getById);
router.patch('/:id', rulesController.update);
router.delete('/:id', rulesController.delete);

export default router;
