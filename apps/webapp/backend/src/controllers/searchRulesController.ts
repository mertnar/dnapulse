import { Request, Response } from 'express';
import { searchRulesService } from '../services/searchRulesService.js';

export const searchRulesController = {
  async getRules(req: Request, res: Response) {
    try {
      const rules = await searchRulesService.getRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRuleById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rule = await searchRulesService.getRuleById(id);
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      res.json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRulesByStatus(req: Request, res: Response) {
    try {
      const { enabled } = req.params;
      const rules = await searchRulesService.getRulesByStatus(enabled === 'true');
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRulesBySeverity(req: Request, res: Response) {
    try {
      const { severity } = req.params;
      const rules = await searchRulesService.getRulesBySeverity(severity);
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRulesByOutputType(req: Request, res: Response) {
    try {
      const { outputType } = req.params;
      const rules = await searchRulesService.getRulesByOutputType(outputType);
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async createRule(req: Request, res: Response) {
    try {
      const rule = await searchRulesService.createRule(req.body);
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateRule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rule = await searchRulesService.updateRule(id, req.body);
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      res.json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async toggleRuleStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const rule = await searchRulesService.toggleRuleStatus(id);
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      res.json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteRule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await searchRulesService.deleteRule(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
