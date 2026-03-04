import { Request, Response } from 'express';
import { agentInstancesService } from '../services/agentInstancesService.js';

export const agentInstancesController = {
  async getAllInstances(req: Request, res: Response) {
    try {
      const organizationId = req.query.organizationId as string | undefined;
      const instances = await agentInstancesService.getAllInstances(organizationId);
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getInstancesByAgent(req: Request, res: Response) {
    try {
      const { agentId } = req.params;
      const instances = await agentInstancesService.getInstancesByAgent(agentId);
      res.json(instances);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getInstance(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const instance = await agentInstancesService.getInstance(instanceId);
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      res.json(instance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateConfig(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const { config } = req.body;
      const updated = await agentInstancesService.updateConfig(instanceId, config);
      if (!updated) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async sendCommand(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const { command } = req.body;
      const result = await agentInstancesService.sendCommand(instanceId, command);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getLogs(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await agentInstancesService.getLogs(instanceId, limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getMetrics(req: Request, res: Response) {
    try {
      const { instanceId } = req.params;
      const metrics = await agentInstancesService.getMetrics(instanceId);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
