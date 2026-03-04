import { Request, Response } from 'express';
import { settingsService } from '../services/settingsService.js';

export const settingsController = {
  async getOrganization(req: Request, res: Response) {
    try {
      const org = await settingsService.getOrganization();
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateOrganization(req: Request, res: Response) {
    try {
      const org = await settingsService.updateOrganization(req.body);
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getCurrentUser(req: Request, res: Response) {
    try {
      const user = await settingsService.getCurrentUser();
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateCurrentUser(req: Request, res: Response) {
    try {
      const user = await settingsService.updateCurrentUser(req.body);
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getSystemSettings(req: Request, res: Response) {
    try {
      const settings = await settingsService.getSystemSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateSystemSettings(req: Request, res: Response) {
    try {
      const settings = await settingsService.updateSystemSettings(req.body);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
