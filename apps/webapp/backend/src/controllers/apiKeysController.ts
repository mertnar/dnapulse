import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { apiKeysService } from '../services/apiKeysService.js';

export const apiKeysController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const apiKeys = await apiKeysService.getAll(organizationId);
      res.json(apiKeys);
    } catch (error: any) {
      console.error('Error fetching API keys:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const apiKey = await apiKeysService.getById(id);

      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json(apiKey);
    } catch (error: any) {
      console.error('Error fetching API key:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { name, permissions, expiresAt } = req.body;
      const organizationId = req.user?.organization_id;
      const createdBy = req.user?.user_id;

      if (!organizationId || !createdBy) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const result = await apiKeysService.create({
        name,
        organizationId,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy,
      });

      // Return both the API key object and the plain key
      res.status(201).json({
        ...result.apiKey,
        key: result.plainKey, // Include plain key in response
      });
    } catch (error: any) {
      console.error('Error creating API key:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const deleted = await apiKeysService.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting API key:', error);
      res.status(500).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, permissions, expiresAt } = req.body;
      const organizationId = req.user?.organization_id;

      if (!organizationId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updated = await apiKeysService.update(id, {
        name,
        permissions,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      if (!updated) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating API key:', error);
      res.status(500).json({ error: error.message });
    }
  },
};
