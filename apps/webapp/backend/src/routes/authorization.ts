import express from 'express';
import { authorizationController } from '../controllers/authorizationController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/roles', authorizationController.getRoles);
router.get('/roles/:id', authorizationController.getRoleById);
router.post('/roles', authorizationController.createRole);
router.put('/roles/:id', authorizationController.updateRole);
router.delete('/roles/:id', authorizationController.deleteRole);
router.get('/users', authorizationController.getUsers);
router.post('/users', authorizationController.createUser);
router.get('/users/:id', authorizationController.getUserById);
router.get('/users/role/:role', authorizationController.getUsersByRole);
router.put('/users/:userId/role', authorizationController.updateUserRole);

export default router;
