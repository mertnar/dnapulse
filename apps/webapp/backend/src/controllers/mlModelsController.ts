import { Request, Response } from 'express';
import { mlModelsService } from '../services/mlModelsService.js';

export const mlModelsController = {
  async getMLModels(req: Request, res: Response) {
    try {
      const models = await mlModelsService.getMLModels();
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getMLModelById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const model = await mlModelsService.getMLModelById(id);
      if (!model) {
        return res.status(404).json({ error: 'ML model not found' });
      }
      res.json(model);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getModelInputOutput(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const io = await mlModelsService.getModelInputOutput(id);
      res.json(io);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getTrainingDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const details = await mlModelsService.getTrainingDetails(id);
      res.json(details);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getValidationMetrics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const metrics = await mlModelsService.getValidationMetrics(id);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getDeployment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deployment = await mlModelsService.getDeployment(id);
      res.json(deployment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRuntimeMetrics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const metrics = await mlModelsService.getRuntimeMetrics(id);
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getVersionHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const history = await mlModelsService.getVersionHistory(id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getGovernanceNotes(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const notes = await mlModelsService.getGovernanceNotes(id);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async addGovernanceNote(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const note = await mlModelsService.addGovernanceNote(id, req.body);
      res.status(201).json(note);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
