import type { EventSeverity } from '../types';
import { liveMonitorService } from './liveMonitorService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('jwt_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn(
      '⚠️ JWT token not found in localStorage. Please set jwt_token for authentication.'
    );
  }

  return headers;
};

export type VisualizationType = 'table' | 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';

export interface ChartConfig {
  type: VisualizationType;
  xAxis?: string;
  yAxis?: string | string[];
  groupBy?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  colors?: string[];
  stacked?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  query: string;
  timeRange: '15m' | '1h' | '24h' | '7d';
  columns: string[];
  filters: Record<string, any>;
  visualization?: ChartConfig;
  datasourceScope?: string[];
  lastRunTime: string;
  linkedRulesCount: number;
  createdAt: string;
}

export interface DetectionRule {
  id?: string;
  name: string;
  query: string;
  condition: {
    type: 'count' | 'unique' | 'rate';
    field?: string;
    threshold: number;
    time_window_min: number;
  };
  severity: EventSeverity;
  tags: string[];
  enabled: boolean;
  schedule_sec?: number;
  cooldown_min?: number;
  last_run_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export type AlertStatus = 'triggered' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

export interface Alert {
  id: string;
  organization_id: string;
  rule_id: string | null;
  rule_snapshot?: any;
  severity: EventSeverity;
  status: AlertStatus;
  title: string;
  description: string | null;
  window?: {
    from: Date | string;
    to: Date | string;
  };
  match_count?: number;
  sample_event_ids?: string[];
  entities?: {
    hosts: string[];
    users: string[];
    ips: string[];
  };
  investigation_id?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
}

export type InvestigationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface InvestigationNote {
  id: string;
  text: string;
  author_email: string;
  created_at: string;
}

export interface Investigation {
  id?: string;
  organization_id: string;
  title: string;
  status: InvestigationStatus;
  severity: EventSeverity;
  alert_ids: string[];
  event_refs: Array<{ event_id: string }>;
  entities: {
    hosts: string[];
    users: string[];
    ips: string[];
  };
  assigned_to?: string | null;
  created_by: string;
  notes?: InvestigationNote[];
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
}

const handleApiError = async (res: Response, defaultMessage: string) => {
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Authentication required. Please check JWT token in localStorage.');
    }
    const errorData = await res.json().catch(() => ({ error: defaultMessage }));
    throw new Error(errorData.error || defaultMessage);
  }
  return res.json();
};

export const detectionService = {
  // Rules
  async getRules(): Promise<DetectionRule[]> {
    const res = await fetch(`${API_BASE}/rules`, { headers: getAuthHeaders() });
    return handleApiError(res, 'Failed to fetch rules');
  },

  async createRule(
    rule: Omit<DetectionRule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DetectionRule> {
    const res = await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(rule),
    });
    return handleApiError(res, 'Failed to create rule');
  },

  async updateRule(id: string, updates: Partial<DetectionRule>): Promise<DetectionRule> {
    const res = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleApiError(res, 'Failed to update rule');
  },

  async deleteRule(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/rules/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      await handleApiError(res, 'Failed to delete rule');
    }
  },

  // Alerts
  async getAlerts(params?: { status?: string; severity?: string }): Promise<Alert[]> {
    const query = new URLSearchParams(params as any);
    const res = await fetch(`${API_BASE}/alerts?${query}`, { headers: getAuthHeaders() });
    return handleApiError(res, 'Failed to fetch alerts');
  },

  async updateAlertStatus(id: string, status: AlertStatus): Promise<Alert> {
    const res = await fetch(`${API_BASE}/alerts/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleApiError(res, 'Failed to update alert status');
  },

  async investigateAlert(alertId: string, investigationId?: string): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/investigate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ investigation_id: investigationId }),
    });
    const data = await handleApiError(res, 'Failed to investigate alert');
    return data.investigation;
  },

  // Investigations
  async getInvestigations(status?: InvestigationStatus): Promise<Investigation[]> {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${API_BASE}/investigations${query}`, { headers: getAuthHeaders() });
    return handleApiError(res, 'Failed to fetch investigations');
  },

  async getInvestigationById(id: string): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, { headers: getAuthHeaders() });
    return handleApiError(res, 'Failed to fetch investigation');
  },

  async createInvestigation(
    investigation: Omit<Investigation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(investigation),
    });
    return handleApiError(res, 'Failed to create investigation');
  },

  async updateInvestigation(id: string, updates: Partial<Investigation>): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleApiError(res, 'Failed to update investigation');
  },

  async addNoteToInvestigation(investigationId: string, text: string): Promise<InvestigationNote> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/notes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text }),
    });
    return handleApiError(res, 'Failed to add note');
  },

  async addEventsToInvestigation(
    investigationId: string,
    event_ids: string[]
  ): Promise<Investigation> {
    const res = await fetch(`${API_BASE}/investigations/${investigationId}/events`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ event_ids }),
    });
    return handleApiError(res, 'Failed to add events');
  },

  // Saved Views
  async getSavedViews(): Promise<SavedView[]> {
    try {
      const views = await liveMonitorService.getSavedViews();

      return views.map((view: any) => ({
        id: view.id || view._id?.toString() || '',
        name: view.name || '',
        description: view.description || '',
        query: view.query || '',
        timeRange: (view.time_preset || '1h') as '15m' | '1h' | '24h' | '7d',
        columns: view.selected_columns || [],
        filters: view.pinned_filters || {},
        visualization: view.visualization || undefined,
        datasourceScope: view.datasource_scope || [],
        lastRunTime: view.updated_at || view.created_at || new Date().toISOString(),
        linkedRulesCount: 0,
        createdAt: view.created_at || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Failed to fetch saved views:', error);
      return [];
    }
  },

  async createSavedView(view: Omit<SavedView, 'id' | 'createdAt'>): Promise<SavedView> {
    const created = await liveMonitorService.createSavedView({
      name: view.name,
      query: view.query || '',
      time_preset: view.timeRange,
      selected_columns: view.columns || [],
      pinned_filters: view.filters || {},
    });
    return {
      id: created.id || created._id?.toString() || '',
      name: created.name || view.name,
      query: created.query ?? view.query,
      timeRange: (created.time_preset || view.timeRange) as SavedView['timeRange'],
      columns: created.selected_columns || view.columns,
      filters: created.pinned_filters || view.filters,
      lastRunTime: created.updated_at || created.created_at || new Date().toISOString(),
      linkedRulesCount: 0,
      createdAt: created.created_at || new Date().toISOString(),
    };
  },

  async deleteSavedView(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/live-monitor/views/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      await handleApiError(res, 'Failed to delete view');
    }
  },

  async deleteInvestigation(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/investigations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok && res.status !== 204) {
      await handleApiError(res, 'Failed to delete investigation');
    }
  },
};
