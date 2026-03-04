import express from 'express';
import { investigationsController } from '../controllers/investigationsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', investigationsController.getAll);
router.post('/', investigationsController.create);
router.get('/:id', investigationsController.getById);
router.patch('/:id', investigationsController.update);
router.delete('/:id', investigationsController.delete);
router.post('/:id/notes', investigationsController.addNote);
router.post('/:id/events', investigationsController.addEvents);

export default router;
