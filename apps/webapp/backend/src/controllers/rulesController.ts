import { Response } from 'express';
import { rulesService } from '../services/rulesService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const rulesController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const rules = await rulesService.getAll(organization_id);
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const rule = await rulesService.getById(id, organization_id);

      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json(rule);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const rule = await rulesService.create({
        ...req.body,
        organization_id,
        created_by: user_id,
      });
      res.status(201).json(rule);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const rule = await rulesService.update(id, organization_id, req.body);

      if (!rule) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const deleted = await rulesService.delete(id, organization_id);

      if (!deleted) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
