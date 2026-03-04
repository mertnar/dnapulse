import express from 'express';
import { searchRulesController } from '../controllers/searchRulesController.js';

const router = express.Router();

router.get('/', searchRulesController.getRules);
router.get('/status/:enabled', searchRulesController.getRulesByStatus);
router.get('/severity/:severity', searchRulesController.getRulesBySeverity);
router.get('/output-type/:outputType', searchRulesController.getRulesByOutputType);
router.get('/:id', searchRulesController.getRuleById);
router.post('/', searchRulesController.createRule);
router.put('/:id', searchRulesController.updateRule);
router.put('/:id/toggle', searchRulesController.toggleRuleStatus);
router.delete('/:id', searchRulesController.deleteRule);

export default router;
