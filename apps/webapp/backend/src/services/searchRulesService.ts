export const searchRulesService = {
  async getRules(): Promise<any[]> {
    return [];
  },

  async getRuleById(id: string): Promise<any> {
    return null;
  },

  async getRulesByStatus(enabled: boolean): Promise<any[]> {
    return [];
  },

  async getRulesBySeverity(severity: string): Promise<any[]> {
    return [];
  },

  async getRulesByOutputType(outputType: string): Promise<any[]> {
    return [];
  },

  async createRule(data: any): Promise<any> {
    return {
      ...data,
      id: `rule-${Date.now()}`,
      created_at: new Date().toISOString(),
      match_count: 0,
    };
  },

  async updateRule(id: string, updates: any): Promise<any> {
    return null;
  },

  async toggleRuleStatus(id: string): Promise<any> {
    return null;
  },

  async deleteRule(id: string): Promise<void> {
    // Mock implementation
  },
};
