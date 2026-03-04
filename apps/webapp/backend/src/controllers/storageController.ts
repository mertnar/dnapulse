import { Request, Response } from 'express';
import { storageService } from '../services/storageService.js';

export const storageController = {
  async getLifecyclePolicies(req: Request, res: Response) {
    try {
      const policies = await storageService.getLifecyclePolicies();
      res.json(policies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getLifecyclePolicyById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const policy = await storageService.getLifecyclePolicyById(id);
      if (!policy) {
        return res.status(404).json({ error: 'Policy not found' });
      }
      res.json(policy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getLifecyclePolicyByDataType(req: Request, res: Response) {
    try {
      const { dataType } = req.params;
      const policy = await storageService.getLifecyclePolicyByDataType(dataType);
      res.json(policy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async createLifecyclePolicy(req: Request, res: Response) {
    try {
      const policy = await storageService.createLifecyclePolicy(req.body);
      res.status(201).json(policy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateLifecyclePolicy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const policy = await storageService.updateLifecyclePolicy(id, req.body);
      if (!policy) {
        return res.status(404).json({ error: 'Policy not found' });
      }
      res.json(policy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteLifecyclePolicy(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await storageService.deleteLifecyclePolicy(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getStorageStats(req: Request, res: Response) {
    try {
      const stats = await storageService.getStorageStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
