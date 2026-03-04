import type { Rule } from '../types';
import { mockRules } from '../utils/mockData';

export const searchRulesService = {
  async getRules(): Promise<Rule[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockRules), 300);
    });
  },

  async getRuleById(id: string): Promise<Rule | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const rule = mockRules.find((r) => r.id === id);
        resolve(rule);
      }, 300);
    });
  },

  async getRulesByStatus(enabled: boolean): Promise<Rule[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = mockRules.filter((r) => r.enabled === enabled);
        resolve(filtered);
      }, 300);
    });
  },

  async getRulesBySeverity(severity: Rule['severity']): Promise<Rule[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = mockRules.filter((r) => r.severity === severity);
        resolve(filtered);
      }, 300);
    });
  },

  async getRulesByOutputType(outputType: Rule['output_type']): Promise<Rule[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = mockRules.filter((r) => r.output_type === outputType);
        resolve(filtered);
      }, 300);
    });
  },

  async createRule(rule: Omit<Rule, 'id' | 'created_at' | 'match_count'>): Promise<Rule> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newRule: Rule = {
          ...rule,
          id: `rule-${Date.now()}`,
          match_count: 0,
          created_at: new Date().toISOString(),
        };
        resolve(newRule);
      }, 300);
    });
  },

  async updateRule(id: string, updates: Partial<Rule>): Promise<Rule> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const rule = mockRules.find((r) => r.id === id);
        if (rule) {
          resolve({ ...rule, ...updates });
        }
      }, 300);
    });
  },

  async toggleRuleStatus(id: string): Promise<Rule> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const rule = mockRules.find((r) => r.id === id);
        if (rule) {
          resolve({ ...rule, enabled: !rule.enabled });
        }
      }, 300);
    });
  },

  async deleteRule(id: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 300);
    });
  },
};
