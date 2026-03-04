import type { Alert } from '../types';
import { api } from '../lib/api.js';

export const alertsService = {
  async getAlerts(): Promise<Alert[]> {
    try {
      return await api.get<Alert[]>('/alerts');
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }
  },

  async getAlertById(id: string): Promise<Alert | undefined> {
    try {
      return await api.get<Alert>(`/alerts/${id}`);
    } catch (error) {
      console.error('Error fetching alert:', error);
      return undefined;
    }
  },

  async getAlertsByStatus(status: Alert['status']): Promise<Alert[]> {
    try {
      return await api.get<Alert[]>(`/alerts/status/${status}`);
    } catch (error) {
      console.error('Error fetching alerts by status:', error);
      return [];
    }
  },

  async getAlertsBySeverity(severity: Alert['severity']): Promise<Alert[]> {
    try {
      return await api.get<Alert[]>(`/alerts/severity/${severity}`);
    } catch (error) {
      console.error('Error fetching alerts by severity:', error);
      return [];
    }
  },

  async updateAlertStatus(id: string, status: Alert['status']): Promise<Alert | null> {
    try {
      return await api.put<Alert>(`/alerts/${id}/status`, { status });
    } catch (error) {
      console.error('Error updating alert status:', error);
      return null;
    }
  },

  async assignAlert(id: string, userId: string): Promise<Alert | null> {
    try {
      return await api.put<Alert>(`/alerts/${id}/assign`, { userId });
    } catch (error) {
      console.error('Error assigning alert:', error);
      return null;
    }
  },

  async deleteAlert(id: string): Promise<void> {
    try {
      await api.delete<void>(`/alerts/${id}`);
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  },
};
