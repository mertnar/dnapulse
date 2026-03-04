import type { KPIData } from '../types';
import { api } from '../lib/api.js';

export const dashboardService = {
  async getKPIs(): Promise<KPIData[]> {
    return api.get<KPIData[]>('/dashboard/kpis');
  },
};
