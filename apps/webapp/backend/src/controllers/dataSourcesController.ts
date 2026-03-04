import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { dataSourcesService } from '../services/dataSourcesService.js';

export const dataSourcesController = {
  async getDataSources(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const dataSources = await dataSourcesService.getAll(organizationId);
      res.json(dataSources);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getDataSourceById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const dataSource = await dataSourcesService.getById(id);
      if (!dataSource) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      if (dataSource.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json(dataSource);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async createDataSource(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const dataSource = await dataSourcesService.create({
        ...req.body,
        organization_id: organizationId,
      });
      res.status(201).json(dataSource);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateDataSource(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      if (existing.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const dataSource = await dataSourcesService.update(id, req.body);
      res.json(dataSource);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteDataSource(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      if (existing.organization_id !== organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      await dataSourcesService.delete(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async testConnection(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const result = await dataSourcesService.testConnection(id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async runDiscovery(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const model = await dataSourcesService.runDiscovery(id);
      res.json(model);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getDataModel(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const model = await dataSourcesService.getDataModel(id);
      if (!model) {
        return res.status(404).json({ error: 'Data model not found' });
      }
      res.json(model);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getSampleEvents(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const events = await dataSourcesService.getSampleEvents(id);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getSchemaChanges(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const changes = await dataSourcesService.getSchemaChanges(id);
      res.json(changes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async acceptSchemaChanges(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      await dataSourcesService.acceptSchemaChanges(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getErrors(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const errors = await dataSourcesService.getErrors(id);
      res.json(errors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAuditLogs(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const logs = await dataSourcesService.getAuditLogs(id);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async sendTestEvent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      const event = await dataSourcesService.sendTestEvent(id);
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async simulateDrift(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const existing = await dataSourcesService.getById(id);
      if (!existing || existing.organization_id !== organizationId) {
        return res.status(404).json({ error: 'Data source not found' });
      }
      await dataSourcesService.simulateDrift(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
