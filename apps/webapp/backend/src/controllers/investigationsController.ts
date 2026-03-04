import { Response } from 'express';
import { investigationsService } from '../services/investigationsService.js';
import { investigationNotesService } from '../services/investigationNotesService.js';
import type { AuthRequest } from '../middleware/auth.js';

export const investigationsController = {
  async getAll(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const status = req.query.status as any;
      const investigations = await investigationsService.getAll(organization_id, status);
      res.json(investigations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const investigation = await investigationsService.getById(id, organization_id);

      if (!investigation) {
        return res.status(404).json({ error: 'Investigation not found' });
      }

      // Also fetch notes
      const notes = await investigationNotesService.getByInvestigationId(id, organization_id);

      res.json({ ...investigation, notes });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id } = req.user!;
      const investigation = await investigationsService.create({
        ...req.body,
        organization_id,
        created_by: user_id,
      });
      res.status(201).json(investigation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const investigation = await investigationsService.update(id, organization_id, req.body);

      if (!investigation) {
        return res.status(404).json({ error: 'Investigation not found' });
      }

      res.json(investigation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const deleted = await investigationsService.delete(id, organization_id);

      if (!deleted) {
        return res.status(404).json({ error: 'Investigation not found' });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async addNote(req: AuthRequest, res: Response) {
    try {
      const { user_id, organization_id, email } = req.user!;
      const { id } = req.params;
      const { text } = req.body;

      // Verify investigation exists
      const investigation = await investigationsService.getById(id, organization_id);
      if (!investigation) {
        return res.status(404).json({ error: 'Investigation not found' });
      }

      const note = await investigationNotesService.create({
        organization_id,
        investigation_id: id,
        author_id: user_id,
        author_email: email,
        text,
      });

      res.status(201).json(note);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async addEvents(req: AuthRequest, res: Response) {
    try {
      const { organization_id } = req.user!;
      const { id } = req.params;
      const { event_ids } = req.body;

      if (!Array.isArray(event_ids) || event_ids.length === 0) {
        return res.status(400).json({ error: 'event_ids must be a non-empty array' });
      }

      const investigation = await investigationsService.addEvents(id, organization_id, event_ids);

      if (!investigation) {
        return res.status(404).json({ error: 'Investigation not found' });
      }

      res.json(investigation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};
