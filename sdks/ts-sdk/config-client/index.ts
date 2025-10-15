import EventSource from 'eventsource';

export interface LoadResult {
  yaml: string;
  etag: string;
  status: number;
}

export interface SSEUpdate {
  scope: string;
  etag: string;
}

export class ConfigClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Load configuration for the given scope
   * @param scope Configuration scope (e.g., 'processing', 'decision')
   * @param etag Optional ETag for conditional requests
   * @returns Promise with config data, ETag, and status code
   */
  async load(scope: string, etag?: string): Promise<LoadResult> {
    const url = `${this.baseURL}/v1/config/${scope}`;

    const headers: Record<string, string> = {
      Accept: 'application/x-yaml',
    };

    if (etag) {
      headers['If-None-Match'] = etag;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const yaml = await response.text();
    const responseETag = response.headers.get('ETag') || '';

    return {
      yaml,
      etag: responseETag,
      status: response.status,
    };
  }

  /**
   * Watch for configuration updates via Server-Sent Events
   * @param onUpdate Callback function called when config updates are received
   * @returns EventSource instance for manual control
   */
  watchSSE(onUpdate: (update: SSEUpdate) => void): EventSource {
    const sseURL = `${this.baseURL}/v1/stream`;

    const eventSource = new EventSource(sseURL);

    eventSource.addEventListener('config:update', (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate({
          scope: data.scope,
          etag: data.etag,
        });
      } catch (error) {
        console.error('Failed to parse SSE update:', error);
      }
    });

    eventSource.addEventListener('connected', (event) => {
      console.log('Connected to config stream:', event.data);
    });

    eventSource.addEventListener('heartbeat', (event) => {
      console.debug('Config stream heartbeat:', event.data);
    });

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    return eventSource;
  }

  /**
   * Load configuration with retry logic
   * @param scope Configuration scope
   * @param etag Optional ETag for conditional requests
   * @param maxRetries Maximum number of retry attempts
   * @param baseDelayMs Base delay between retries in milliseconds
   * @returns Promise with config data
   */
  async loadWithRetry(
    scope: string,
    etag?: string,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<LoadResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.load(scope, etag);
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries - 1) {
          const delay = baseDelayMs * Math.pow(2, attempt); // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to load config after ${maxRetries} retries: ${lastError?.message}`);
  }
}

/**
 * Load configuration using a simple function interface
 * @param baseURL Base URL of the Config Service
 * @param scope Configuration scope
 * @param etag Optional ETag for conditional requests
 * @returns Promise with config data, ETag, and status code
 */
export async function load(baseURL: string, scope: string, etag?: string): Promise<LoadResult> {
  const client = new ConfigClient(baseURL);
  return client.load(scope, etag);
}

/**
 * Watch for configuration updates via SSE
 * @param sseURL Full URL to the SSE endpoint
 * @param onUpdate Callback function for updates
 * @returns EventSource instance
 */
export function watchSSE(sseURL: string, onUpdate: (update: SSEUpdate) => void): EventSource {
  const client = new ConfigClient(sseURL);
  return client.watchSSE(onUpdate);
}

/**
 * Create a new ConfigClient instance
 * @param baseURL Base URL of the Config Service
 * @returns ConfigClient instance
 */
export function createClient(baseURL: string): ConfigClient {
  return new ConfigClient(baseURL);
}
