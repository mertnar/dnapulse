import express from 'express';
import { settingsController } from '../controllers/settingsController.js';

const router = express.Router();

router.get('/organization', settingsController.getOrganization);
router.put('/organization', settingsController.updateOrganization);
router.get('/user', settingsController.getCurrentUser);
router.put('/user', settingsController.updateCurrentUser);
router.get('/system', settingsController.getSystemSettings);
router.put('/system', settingsController.updateSystemSettings);

export default router;
