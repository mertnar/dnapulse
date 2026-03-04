import express from 'express';
import { storageController } from '../controllers/storageController.js';

const router = express.Router();

router.get('/policies', storageController.getLifecyclePolicies);
router.get('/policies/:id', storageController.getLifecyclePolicyById);
router.get('/policies/data-type/:dataType', storageController.getLifecyclePolicyByDataType);
router.post('/policies', storageController.createLifecyclePolicy);
router.put('/policies/:id', storageController.updateLifecyclePolicy);
router.delete('/policies/:id', storageController.deleteLifecyclePolicy);
router.get('/stats', storageController.getStorageStats);

export default router;
