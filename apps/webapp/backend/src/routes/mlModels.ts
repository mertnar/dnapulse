import express from 'express';
import { mlModelsController } from '../controllers/mlModelsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', mlModelsController.getMLModels);
router.get('/:id', mlModelsController.getMLModelById);
router.get('/:id/input-output', mlModelsController.getModelInputOutput);
router.get('/:id/training', mlModelsController.getTrainingDetails);
router.get('/:id/validation', mlModelsController.getValidationMetrics);
router.get('/:id/deployment', mlModelsController.getDeployment);
router.get('/:id/runtime', mlModelsController.getRuntimeMetrics);
router.get('/:id/versions', mlModelsController.getVersionHistory);
router.get('/:id/governance-notes', mlModelsController.getGovernanceNotes);
router.post('/:id/governance-notes', mlModelsController.addGovernanceNote);

export default router;
