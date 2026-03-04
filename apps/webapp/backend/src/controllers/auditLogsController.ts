import { Request, Response } from 'express';
import { auditLogsService } from '../services/auditLogsService.js';

export const auditLogsController = {
  async getAuditLogs(req: Request, res: Response) {
    try {
      const logs = await auditLogsService.getAuditLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAuditLogById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const log = await auditLogsService.getAuditLogById(id);
      if (!log) {
        return res.status(404).json({ error: 'Audit log not found' });
      }
      res.json(log);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAuditLogsByUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const logs = await auditLogsService.getAuditLogsByUser(userId);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAuditLogsByAction(req: Request, res: Response) {
    try {
      const { action } = req.params;
      const logs = await auditLogsService.getAuditLogsByAction(action);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAuditLogsByResourceType(req: Request, res: Response) {
    try {
      const { resourceType } = req.params;
      const logs = await auditLogsService.getAuditLogsByResourceType(resourceType);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getAuditLogsByDateRange(req: Request, res: Response) {
    try {
      const { startDate, endDate } = req.params;
      const logs = await auditLogsService.getAuditLogsByDateRange(startDate, endDate);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
