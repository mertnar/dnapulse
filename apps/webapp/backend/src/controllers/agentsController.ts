import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { agentsService } from '../services/agentsService.js';

export const agentsController = {
  async getAgents(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const agents = await agentsService.getAll(organizationId);
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAgent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const agent = await agentsService.getById(id);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      if (agent.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async createAgent(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const agent = await agentsService.create({ ...req.body, organizationId });
      res.status(201).json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateAgent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await agentsService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      if (existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const agent = await agentsService.update(id, req.body);
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteAgent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await agentsService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      if (existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await agentsService.delete(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async regenerateToken(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await agentsService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      if (existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.status(501).json({ error: 'Token regeneration not yet implemented' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAgentLogs(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await agentsService.getById(id);
      if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      const logs = await agentsService.getLogs(id);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRecentEvents(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await agentsService.getById(id);
      if (!existing || existing.organizationId !== organizationId) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      const events = await agentsService.getEvents(id);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
