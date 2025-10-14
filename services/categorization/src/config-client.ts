import axios from 'axios';
import EventSource from 'eventsource';

export interface ConfigLoadResult {
  yaml: string;
  etag: string;
  status: number;
}

export class ConfigClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async load(scope: string, etag?: string): Promise<ConfigLoadResult> {
    const headers: Record<string, string> = {};
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/v1/config/${scope}`, {
        headers,
        validateStatus: (status) => status < 500 // Don't throw for 4xx
      });

      return {
        yaml: response.data,
        etag: response.headers['etag'] || '',
        status: response.status
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Config load failed: ${error.message}`);
      }
      throw error;
    }
  }

  watchSSE(sseUrl: string, onUpdate: (scope: string, etag: string) => void): EventSource {
    const eventSource = new EventSource(`${sseUrl}/v1/stream`);
    
    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.scope && data.etag) {
          onUpdate(data.scope, data.etag);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error: Event) => {
      console.error('SSE connection error:', error);
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        eventSource.close();
        this.watchSSE(sseUrl, onUpdate);
      }, 5000);
    };

    return eventSource;
  }
}
