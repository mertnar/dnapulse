import type { AuditLog } from '../types';
import { mockAuditLogs } from '../utils/mockData';

export const auditLogsService = {
  async getAuditLogs(): Promise<AuditLog[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockAuditLogs), 300);
    });
  },

  async getAuditLogById(id: string): Promise<AuditLog | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const log = mockAuditLogs.find((l) => l.id === id);
        resolve(log);
      }, 300);
    });
  },

  async getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = mockAuditLogs.filter((l) => l.user_id === userId);
        resolve(filtered);
      }, 300);
    });
  },

  async getAuditLogsByAction(action: string): Promise<AuditLog[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = mockAuditLogs.filter((l) => l.action === action);
        resolve(filtered);
      }, 300);
    });
  },

  async getAuditLogsByResourceType(resourceType: string): Promise<AuditLog[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = mockAuditLogs.filter((l) => l.resource_type === resourceType);
        resolve(filtered);
      }, 300);
    });
  },

  async getAuditLogsByDateRange(startDate: string, endDate: string): Promise<AuditLog[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = mockAuditLogs.filter((l) => {
          const logDate = new Date(l.created_at);
          return logDate >= new Date(startDate) && logDate <= new Date(endDate);
        });
        resolve(filtered);
      }, 300);
    });
  },
};
