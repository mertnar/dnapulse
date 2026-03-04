import type { Organization, User } from '../types';
import { mockOrganization, mockUsers } from '../utils/mockData';

export interface SystemSettings {
  dataRetentionDays: number;
  alertThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  emailNotifications: boolean;
  slackIntegration: boolean;
  apiRateLimit: number;
  sessionTimeout: number;
}

export const settingsService = {
  async getOrganization(): Promise<Organization> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockOrganization), 300);
    });
  },

  async updateOrganization(updates: Partial<Organization>): Promise<Organization> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...mockOrganization, ...updates });
      }, 300);
    });
  },

  async getCurrentUser(): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockUsers[0]), 300);
    });
  },

  async updateCurrentUser(updates: Partial<User>): Promise<User> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...mockUsers[0], ...updates });
      }, 300);
    });
  },

  async getSystemSettings(): Promise<SystemSettings> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          dataRetentionDays: 365,
          alertThresholds: {
            critical: 95,
            high: 85,
            medium: 70,
            low: 50,
          },
          emailNotifications: true,
          slackIntegration: false,
          apiRateLimit: 1000,
          sessionTimeout: 3600,
        });
      }, 300);
    });
  },

  async updateSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const current = {
          dataRetentionDays: 365,
          alertThresholds: {
            critical: 95,
            high: 85,
            medium: 70,
            low: 50,
          },
          emailNotifications: true,
          slackIntegration: false,
          apiRateLimit: 1000,
          sessionTimeout: 3600,
        };
        resolve({ ...current, ...updates });
      }, 300);
    });
  },
};
