import { Response } from 'express';
import { detectionService } from '../services/detectionService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const detectionController = {
  async searchEvents(req: AuthRequest, res: Response) {
    try {
      const { index, query, from, to, limit } = req.body;

      if (!index) {
        return res.status(400).json({ error: 'index is required' });
      }

      if (!from || !to) {
        return res.status(400).json({ error: 'from and to dates are required' });
      }

      const events = await detectionService.searchEvents({
        index,
        query: query || '',
        time_range: {
          from: new Date(from),
          to: new Date(to),
        },
        limit: limit || 100,
      });

      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async aggregateEvents(req: AuthRequest, res: Response) {
    try {
      const { index, query, from, to, interval_min } = req.body;

      if (!index) {
        return res.status(400).json({ error: 'index is required' });
      }

      if (!from || !to) {
        return res.status(400).json({ error: 'from and to dates are required' });
      }

      const aggregation = await detectionService.aggregateEvents({
        index,
        query: query || '',
        time_range: {
          from: new Date(from),
          to: new Date(to),
        },
        interval_min: interval_min || 5,
      });

      res.json(aggregation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
