import { Response } from 'express';
import { alertsService } from '../services/alertsService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const alertsController = {
  async getAlerts(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const status = req.query.status as any;
      const severity = req.query.severity as any;
      const alerts = await alertsService.getAll(organizationId, status, severity);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAlertById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const alert = await alertsService.getById(id);
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      if (alert.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAlertsByStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const alerts = await alertsService.getAll(organizationId, status as any);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAlertsBySeverity(req: AuthRequest, res: Response) {
    try {
      const { severity } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const alerts = await alertsService.getAll(organizationId, undefined, severity as any);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateAlertStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await alertsService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      if (existing.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const alert = await alertsService.update(id, { status });
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async assignAlert(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await alertsService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      if (existing.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const alert = await alertsService.update(id, { assigned_to: userId });
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteAlert(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await alertsService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      if (existing.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await alertsService.delete(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const { status } = req.body;

      const alert = await alertsService.updateStatus(id, organization_id, status);
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async investigate(req: AuthRequest, res: Response) {
    try {
      const { organization_id, user_id } = req.user!;
      const { id } = req.params;
      const { investigation_id } = req.body;

      const alert = await alertsService.getById(id);
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      // Import investigationsService dynamically to avoid circular dependency
      const { investigationsService } = await import('../services/investigationsService.js');

      let investigation;

      if (investigation_id) {
        // Link to existing investigation
        investigation = await investigationsService.getById(investigation_id, organization_id);
        if (!investigation) {
          return res.status(404).json({ error: 'Investigation not found' });
        }

        await investigationsService.addAlert(investigation_id, organization_id, id);
      } else {
        // Create new investigation
        investigation = await investigationsService.create({
          organization_id,
          title: `Investigation: ${alert.title}`,
          status: 'open',
          severity: alert.severity,
          alert_ids: [id],
          event_refs: (alert.sample_event_ids || []).map((eid) => ({ event_id: eid })),
          entities: alert.entities || { hosts: [], users: [], ips: [] },
          created_by: user_id,
        });
      }

      await alertsService.linkToInvestigation(id, organization_id, investigation.id!);
      await alertsService.updateStatus(id, organization_id, 'in_progress');

      res.json({ investigation });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
