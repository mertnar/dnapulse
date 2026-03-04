import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { liveMonitorService } from '../services/liveMonitorService.js';
import { savedViewsService } from '../services/savedViewsService.js';
import { kafkaStreamService } from '../services/kafkaStreamService.js';

export const liveMonitorController = {
  /**
   * POST /api/live-monitor/search
   * Search events with KQL query and pagination
   */
  async search(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const params = { ...req.body, organization_id: organizationId };
      const result = await liveMonitorService.searchEvents(params);
      res.json(result);
    } catch (error: any) {
      console.error('Live Monitor search error:', error);
      res.status(500).json({ error: error.message || 'Search failed' });
    }
  },

  /**
   * POST /api/live-monitor/agg
   * Get histogram aggregation grouped by severity
   */
  async aggregation(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const params = { ...req.body, organization_id: organizationId };
      const histogram = await liveMonitorService.getAggregation(params);
      res.json(histogram);
    } catch (error: any) {
      console.error('Live Monitor aggregation error:', error);
      res.status(500).json({ error: error.message || 'Aggregation failed' });
    }
  },

  /**
   * GET /api/live-monitor/fields?index=...
   * Get available fields from Elasticsearch index mappings
   */
  async getFields(req: AuthRequest, res: Response) {
    try {
      const index = req.query.index as string | undefined;
      const fieldGroups = await liveMonitorService.getFields(index);
      res.json(fieldGroups);
    } catch (error: any) {
      console.error('Live Monitor get fields error:', error);
      res.status(500).json({ error: error.message || 'Failed to get fields' });
    }
  },

  /**
   * POST /api/live-monitor/facet
   * Get top values (facets) for a field
   */
  async facet(req: AuthRequest, res: Response) {
    try {
      const { field, index, time_range, query, limit } = req.body;

      if (!field) {
        return res.status(400).json({ error: 'field is required' });
      }

      if (!index) {
        return res.status(400).json({ error: 'index is required' });
      }

      // Parse time range
      let from: Date, to: Date;
      if (time_range?.preset) {
        const preset = time_range.preset;
        const now = new Date();
        switch (preset) {
          case '15m':
            from = new Date(now.getTime() - 15 * 60 * 1000);
            break;
          case '1h':
            from = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '4h':
            from = new Date(now.getTime() - 4 * 60 * 60 * 1000);
            break;
          case '24h':
            from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '1m':
            from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            from = new Date(now.getTime() - 60 * 60 * 1000);
        }
        to = now;
      } else if (time_range?.from && time_range?.to) {
        from = new Date(time_range.from);
        to = new Date(time_range.to);
      } else {
        from = new Date(Date.now() - 60 * 60 * 1000);
        to = new Date();
      }

      const facetValues = await liveMonitorService.getFacetValues(
        field,
        index,
        { from, to },
        query || '',
        limit || 10
      );
      res.json(facetValues);
    } catch (error: any) {
      console.error('Live Monitor facet error:', error);
      res.status(500).json({ error: error.message || 'Facet query failed' });
    }
  },

  /**
   * GET /api/live-monitor/stream
   * SSE stream for real-time events
   */
  async stream(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' });
      }
      const filterStr = req.query.filter as string | undefined;

      // Parse filter if provided
      let filter = {};
      if (filterStr) {
        try {
          filter = JSON.parse(filterStr);
        } catch (e) {
          console.error('Failed to parse filter:', e);
        }
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Subscribe to Kafka events
      const subscriptionId = await kafkaStreamService.subscribe(organizationId, filter);
      const emitter = kafkaStreamService.getEmitter(subscriptionId);

      if (!emitter) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to subscribe' })}\n\n`);
        res.end();
        return;
      }

      // Listen for events
      emitter.on('event', (event: any) => {
        res.write(`data: ${JSON.stringify({ type: 'event', data: event })}\n\n`);
      });

      // Handle client disconnect
      req.on('close', async () => {
        await kafkaStreamService.unsubscribe(subscriptionId);
        res.end();
      });

      // Keep-alive ping every 30 seconds
      const keepAliveInterval = setInterval(() => {
        res.write(`:keep-alive\n\n`);
      }, 30000);

      req.on('close', () => {
        clearInterval(keepAliveInterval);
      });
    } catch (error: any) {
      console.error('Live Monitor stream error:', error);
      res.status(500).json({ error: error.message || 'Stream failed' });
    }
  },

  /**
   * GET /api/live-monitor/events/:id
   * Get event by ID with full payload
   */
  async getEventById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const event = await liveMonitorService.getEventById(id);

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json(event);
    } catch (error: any) {
      console.error('Get event by ID error:', error);
      res.status(500).json({ error: error.message || 'Failed to get event' });
    }
  },

  /**
   * GET /api/live-monitor/stats
   * Get summary stats
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const stats = await liveMonitorService.getStats(organizationId);
      res.json(stats);
    } catch (error: any) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: error.message || 'Failed to get stats' });
    }
  },

  // ===== Saved Views =====

  /**
   * POST /api/live-monitor/views
   * Create a new saved view
   */
  async createView(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      const userId = req.user?.user_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const view = { ...req.body, organization_id: organizationId, created_by: userId };
      if (!view.name) {
        return res.status(400).json({ error: 'name is required' });
      }
      if (!view.query) {
        view.query = '';
      }
      const createdView = await savedViewsService.createView(view);
      res.status(201).json(createdView);
    } catch (error: any) {
      console.error('Create view error:', error);
      res.status(500).json({ error: error.message || 'Failed to create view' });
    }
  },

  /**
   * GET /api/live-monitor/views
   * Get all saved views for an organization
   */
  async listViews(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const views = await savedViewsService.getViews(organizationId);
      res.json(views);
    } catch (error: any) {
      console.error('List views error:', error);
      res.status(500).json({ error: error.message || 'Failed to list views' });
    }
  },

  /**
   * GET /api/live-monitor/views/:id
   * Get a saved view by ID
   */
  async getView(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const view = await savedViewsService.getViewById(id);
      if (!view) {
        return res.status(404).json({ error: 'View not found' });
      }
      if (view.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json(view);
    } catch (error: any) {
      console.error('Get view error:', error);
      res.status(500).json({ error: error.message || 'Failed to get view' });
    }
  },

  /**
   * PUT /api/live-monitor/views/:id
   * Update a saved view
   */
  async updateView(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await savedViewsService.getViewById(id);
      if (!existing) {
        return res.status(404).json({ error: 'View not found' });
      }
      if (existing.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const updates = req.body;

      const updatedView = await savedViewsService.updateView(id, updates);

      if (!updatedView) {
        return res.status(404).json({ error: 'View not found' });
      }

      res.json(updatedView);
    } catch (error: any) {
      console.error('Update view error:', error);
      res.status(500).json({ error: error.message || 'Failed to update view' });
    }
  },

  /**
   * DELETE /api/live-monitor/views/:id
   * Delete a saved view
   */
  async deleteView(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await savedViewsService.getViewById(id);
      if (!existing) {
        return res.status(404).json({ error: 'View not found' });
      }
      if (existing.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await savedViewsService.deleteView(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete view error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete view' });
    }
  },

  // Legacy methods (kept for compatibility)
  async getEvents(req: AuthRequest, res: Response) {
    return this.search(req, res);
  },

  async getHistogram(req: AuthRequest, res: Response) {
    return this.aggregation(req, res);
  },

  async getFieldInfo(req: AuthRequest, res: Response) {
    try {
      const { name } = req.params;
      const { index, time_range, query } = req.body;

      if (!index) {
        return res.status(400).json({ error: 'index is required' });
      }

      // Parse time range
      let from: Date, to: Date;
      if (time_range?.preset) {
        const preset = time_range.preset;
        const now = new Date();
        switch (preset) {
          case '15m':
            from = new Date(now.getTime() - 15 * 60 * 1000);
            break;
          case '1h':
            from = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '4h':
            from = new Date(now.getTime() - 4 * 60 * 60 * 1000);
            break;
          case '24h':
            from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '1m':
            from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            from = new Date(now.getTime() - 60 * 60 * 1000);
        }
        to = now;
      } else if (time_range?.from && time_range?.to) {
        from = new Date(time_range.from);
        to = new Date(time_range.to);
      } else {
        from = new Date(Date.now() - 60 * 60 * 1000);
        to = new Date();
      }

      const facetValues = await liveMonitorService.getFacetValues(
        name,
        index,
        { from, to },
        query || '',
        10
      );
      res.json({
        name,
        topValues: facetValues,
      });
    } catch (error: any) {
      console.error('Get field info error:', error);
      res.status(500).json({ error: error.message || 'Failed to get field info' });
    }
  },

  async searchEvents(req: AuthRequest, res: Response) {
    return this.search(req, res);
  },
};
