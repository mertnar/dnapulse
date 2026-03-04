export const storageService = {
  async getLifecyclePolicies(): Promise<any[]> {
    return [];
  },

  async getLifecyclePolicyById(id: string): Promise<any> {
    return null;
  },

  async getLifecyclePolicyByDataType(dataType: string): Promise<any> {
    return null;
  },

  async createLifecyclePolicy(data: any): Promise<any> {
    return { ...data, id: `policy-${Date.now()}`, created_at: new Date().toISOString() };
  },

  async updateLifecyclePolicy(id: string, updates: any): Promise<any> {
    return null;
  },

  async deleteLifecyclePolicy(id: string): Promise<void> {
    // Mock implementation
  },

  async getStorageStats(): Promise<any> {
    return { total: '68.4TB', hot: '12.3TB', medium: '28.1TB', cold: '28.0TB' };
  },
};
