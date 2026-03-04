import type { LifecyclePolicy } from '../types';
import { mockLifecyclePolicies } from '../utils/mockData';

export const storageService = {
  async getLifecyclePolicies(): Promise<LifecyclePolicy[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockLifecyclePolicies), 300);
    });
  },

  async getLifecyclePolicyById(id: string): Promise<LifecyclePolicy | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const policy = mockLifecyclePolicies.find((p) => p.id === id);
        resolve(policy);
      }, 300);
    });
  },

  async getLifecyclePolicyByDataType(
    dataType: string | null
  ): Promise<LifecyclePolicy | undefined> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const policy = mockLifecyclePolicies.find((p) => p.data_type === dataType);
        resolve(policy);
      }, 300);
    });
  },

  async createLifecyclePolicy(
    policy: Omit<LifecyclePolicy, 'id' | 'created_at'>
  ): Promise<LifecyclePolicy> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const newPolicy: LifecyclePolicy = {
          ...policy,
          id: `policy-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        resolve(newPolicy);
      }, 300);
    });
  },

  async updateLifecyclePolicy(
    id: string,
    updates: Partial<LifecyclePolicy>
  ): Promise<LifecyclePolicy> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const policy = mockLifecyclePolicies.find((p) => p.id === id);
        if (policy) {
          resolve({ ...policy, ...updates });
        }
      }, 300);
    });
  },

  async deleteLifecyclePolicy(id: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 300);
    });
  },

  async getStorageStats(): Promise<{
    total: string;
    hot: string;
    medium: string;
    cold: string;
  }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          total: '68.4TB',
          hot: '12.3TB',
          medium: '28.1TB',
          cold: '28.0TB',
        });
      }, 300);
    });
  },
};
