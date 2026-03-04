import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { dashboardService } from '../services/dashboardService.js';

export const dashboardController = {
  async getKPIs(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const stats = await dashboardService.getStats(organizationId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
