import express from 'express';
import { dataModelsController } from '../controllers/dataModelsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// CRUD operations
router.get('/', dataModelsController.getAll);
router.post('/', dataModelsController.create);
router.get('/operations', dataModelsController.getAvailableOperations);
router.get('/:id', dataModelsController.getById);
router.patch('/:id', dataModelsController.update);
router.delete('/:id', dataModelsController.delete);

// Version management
router.post('/:id/version', dataModelsController.createVersion);

// Lineage
router.get('/:id/lineage', dataModelsController.getLineage);

// Pipeline testing
router.post('/test-pipeline', dataModelsController.testPipeline);

// Attribute routes
router.get('/:id/attributes', dataModelsController.getAttributes);
router.post('/:id/attributes', dataModelsController.createAttribute);
router.patch('/attributes/:attrId', dataModelsController.updateAttribute);
router.delete('/attributes/:attrId', dataModelsController.deleteAttribute);

// Pipeline management routes
router.get('/:id/pipeline', dataModelsController.getPipeline);
router.post('/:id/pipeline', dataModelsController.createPipeline);
router.patch('/:id/pipeline/:pipelineId', dataModelsController.updatePipeline);
router.post('/:id/pipeline/:pipelineId/deploy', dataModelsController.deployPipeline);
router.post('/:id/pipeline/test', dataModelsController.testPipelineStep);

// Derived model creation
router.post('/derived', dataModelsController.createDerivedModel);

// Vector model creation
router.post('/vector', dataModelsController.createVectorModel);

export default router;
