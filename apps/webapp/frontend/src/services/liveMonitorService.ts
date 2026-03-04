import type { EventSeverity, Event } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const BACKEND_URL = `${API_BASE}/live-monitor`;

function getAuthHeaders() {
  const token = localStorage.getItem('jwt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface LiveEvent extends Event {
  host?: string;
  user?: string;
  service?: string;
  ip_address?: string;
  process_name?: string;
  file_path?: string;
  network_protocol?: string;
  port?: number;
}

export interface HistogramBucket {
  timestamp: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface FieldInfo {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  category: 'common' | 'system' | 'payload' | 'metadata';
  example?: any;
  topValues?: { value: string; count: number }[];
}

export interface FieldGroup {
  category: 'common' | 'system' | 'payload' | 'metadata';
  fields: FieldInfo[];
}

export interface SearchParams {
  organization_id?: string;
  index?: string; // ELK index name
  time_range?: {
    preset?: '15m' | '1h' | '4h' | '24h' | '7d' | '1m';
    from?: string;
    to?: string;
  };
  query?: string;
  limit?: number;
  cursor?: string;
  severity?: EventSeverity[];
}

/**
 * Convert minutes to preset string
 */
function minutesToPreset(minutes: number): string {
  if (minutes <= 15) return '15m';
  if (minutes <= 60) return '1h';
  if (minutes <= 240) return '4h';
  if (minutes <= 1440) return '24h';
  if (minutes <= 10080) return '7d';
  return '1m';
}

export const liveMonitorService = {
  /**
   * Search events with optional filters
   */
  async searchEvents(
    params: SearchParams = {}
  ): Promise<{ events: LiveEvent[]; next_cursor?: string; total?: number }> {
    try {
      const searchParams = {
        index: params.index,
        time_range: params.time_range || { preset: '1h' },
        query: params.query || '',
        limit: params.limit || 100,
        cursor: params.cursor,
        severity: params.severity,
      };

      const res = await fetch(`${BACKEND_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(searchParams),
      });

      if (!res.ok) {
        throw new Error(`Search failed: ${res.statusText}`);
      }

      const data = await res.json();
      return {
        events: data.events || [],
        total: data.total_estimate,
        next_cursor: data.next_cursor,
      };
    } catch (error) {
      console.error('Error searching events:', error);
      return { events: [] };
    }
  },

  /**
   * Get events (legacy method - redirects to searchEvents)
   */
  async getEvents(
    query?: string,
    timeRange?: { start: Date; end: Date },
    severity?: EventSeverity[],
    sources?: string[]
  ): Promise<LiveEvent[]> {
    const params: SearchParams = {
      query,
      severity,
      time_range: timeRange
        ? { from: timeRange.start.toISOString(), to: timeRange.end.toISOString() }
        : { preset: '1h' },
    };

    const result = await this.searchEvents(params);
    return result.events;
  },

  /**
   * Get recent events
   */
  async getRecentEvents(limit: number = 10): Promise<LiveEvent[]> {
    const result = await this.searchEvents({ limit, time_range: { preset: '1h' } });
    return result.events;
  },

  /**
   * Get histogram aggregation
   */
  async getHistogram(minutes: number = 60, index?: string): Promise<HistogramBucket[]> {
    try {
      const preset = minutesToPreset(minutes);
      const interval = Math.max(1, Math.floor(minutes / 20)); // 20 buckets

      const res = await fetch(`${BACKEND_URL}/agg`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          index,
          time_range: { preset },
          interval,
        }),
      });

      if (!res.ok) {
        throw new Error(`Aggregation failed: ${res.statusText}`);
      }

      const buckets = await res.json();
      return buckets || [];
    } catch (error) {
      console.error('Error fetching histogram:', error);
      return [];
    }
  },

  /**
   * Get available fields from Elasticsearch index
   */
  async getFields(index?: string): Promise<FieldGroup[]> {
    try {
      const url = index
        ? `${BACKEND_URL}/fields?index=${encodeURIComponent(index)}`
        : `${BACKEND_URL}/fields`;

      const res = await fetch(url, {
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) {
        throw new Error(`Get fields failed: ${res.statusText}`);
      }

      const fieldGroups = await res.json();
      return fieldGroups || [];
    } catch (error) {
      console.error('Error fetching fields:', error);
      return [];
    }
  },

  /**
   * Get facet values (top values) for a field
   */
  async getFacetValues(
    fieldName: string,
    index: string,
    time_range: { preset?: string; from?: string; to?: string },
    query: string = '',
    limit: number = 10
  ): Promise<{ value: string; count: number }[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/facet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          field: fieldName,
          index,
          time_range,
          query,
          limit,
        }),
      });

      if (!res.ok) {
        throw new Error(`Get facet values failed: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error('Error fetching facet values:', error);
      return [];
    }
  },

  /**
   * Get field info with top values
   */
  async getFieldInfo(fieldName: string): Promise<FieldInfo | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/facet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          field: fieldName,
          limit: 10,
        }),
      });

      if (!res.ok) {
        throw new Error(`Get field info failed: ${res.statusText}`);
      }

      const topValues = await res.json();

      return {
        name: fieldName,
        type: 'string',
        category: 'common',
        topValues: topValues || [],
      };
    } catch (error) {
      console.error('Error fetching field info:', error);
      return null;
    }
  },

  /**
   * Create EventSource for real-time streaming
   */
  createEventStream(filter: any = {}): EventSource {
    const token = localStorage.getItem('jwt_token');
    const params = new URLSearchParams({
      filter: JSON.stringify(filter),
      ...(token ? { token } : {}),
    });

    return new EventSource(`${BACKEND_URL}/stream?${params}`);
  },

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<LiveEvent | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/events/${eventId}`, {
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) {
        throw new Error(`Get event failed: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error('Error fetching event:', error);
      return null;
    }
  },

  /**
   * Get stats summary
   */
  async getStats(): Promise<any> {
    try {
      const res = await fetch(`${BACKEND_URL}/stats`, {
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) {
        throw new Error(`Get stats failed: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {};
    }
  },

  /**
   * Saved views management
   */
  async getSavedViews(): Promise<any[]> {
    try {
      const res = await fetch(`${BACKEND_URL}/views`, {
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) {
        throw new Error(`Get views failed: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error('Error fetching saved views:', error);
      return [];
    }
  },

  async createSavedView(view: any): Promise<any> {
    try {
      const res = await fetch(`${BACKEND_URL}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(view),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || `Create view failed: ${res.statusText}`);
      }

      return await res.json();
    } catch (error) {
      console.error('Error creating saved view:', error);
      throw error;
    }
  },

  async deleteSavedView(viewId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BACKEND_URL}/views/${viewId}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });

      return res.ok;
    } catch (error) {
      console.error('Error deleting saved view:', error);
      return false;
    }
  },

  /**
   * Add filter helper
   */
  addFilter(fieldName: string, value: string): string {
    return `${fieldName}:${value}`;
  },
};
