export const settingsService = {
  async getOrganization(): Promise<any> {
    return { id: 'org-1', name: 'Default Organization' };
  },

  async updateOrganization(updates: any): Promise<any> {
    return { id: 'org-1', name: 'Default Organization', ...updates };
  },

  async getCurrentUser(): Promise<any> {
    return { id: 'user-1', name: 'Admin User', email: 'admin@example.com' };
  },

  async updateCurrentUser(updates: any): Promise<any> {
    return { id: 'user-1', name: 'Admin User', email: 'admin@example.com', ...updates };
  },

  async getSystemSettings(): Promise<any> {
    return {
      dataRetentionDays: 365,
      alertThresholds: { critical: 95, high: 85, medium: 70, low: 50 },
      emailNotifications: true,
      slackIntegration: false,
      apiRateLimit: 1000,
      sessionTimeout: 3600,
    };
  },

  async updateSystemSettings(updates: any): Promise<any> {
    const current = await this.getSystemSettings();
    return { ...current, ...updates };
  },
};
