import { ConfigClient } from '../config/client';
import { CategorizationConfig } from '../model';
import pino from 'pino';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('ConfigClient Simple Tests', () => {
  let configClient: ConfigClient;
  let mockLogger: pino.Logger;

  beforeEach(() => {
    mockLogger = pino({ level: 'silent' });
    configClient = new ConfigClient({
      baseUrl: 'http://localhost:8084',
      scope: 'categorization',
      timeout: 5000,
      logger: mockLogger,
    });
    jest.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load configuration successfully', async () => {
      const mockConfig: CategorizationConfig = {
        version: 1,
        cardinality: 'one_to_many',
        label_kind: 'category',
        default_label: 'uncategorized',
        targets: {
          item_types: ['metric', 'log'],
        },
        pipelines: [
          {
            name: 'high_cpu_detector',
            labeler: 'rule_based',
            enabled: true,
            priority: 10,
            args: {
              rules: [
                {
                  when: 'payload.cpu_load > 0.9',
                  label: 'high_cpu',
                  score: 0.95,
                },
              ],
            },
          },
        ],
        persistence: {
          mongodb: {
            enabled: true,
            collection: 'item_labels',
          },
          elasticsearch: {
            enabled: false,
            index: 'categorized-items',
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockConfig,
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: 'http://localhost:8084/v1/config/categorization',
        clone: jest.fn(),
        body: null,
        bodyUsed: false,
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
        text: jest.fn(),
      } as Response);

      const result = await configClient.loadConfig();

      expect(result).toEqual(mockConfig);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8084/v1/config/categorization', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle config service errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: 'http://localhost:8084/v1/config/categorization',
        clone: jest.fn(),
        body: null,
        bodyUsed: false,
        arrayBuffer: jest.fn(),
        blob: jest.fn(),
        formData: jest.fn(),
        text: jest.fn(),
      } as Response);

      await expect(configClient.loadConfig()).rejects.toThrow(
        'Config service returned 500: Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(configClient.loadConfig()).rejects.toThrow('Network error');
    });
  });

  describe('watchConfig', () => {
    beforeEach(() => {
      // Clean up any existing EventSource mock
      delete (global as any).EventSource;
    });

    it('should establish SSE connection', () => {
      const onUpdate = jest.fn();

      // Mock EventSource constructor
      const mockEventSource = {
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSED: 2,
      };

      const EventSourceMock = jest.fn().mockImplementation(() => mockEventSource);
      (global as any).EventSource = EventSourceMock;

      configClient.watchConfig(onUpdate);

      expect(EventSourceMock).toHaveBeenCalledWith('http://localhost:8084/v1/stream');
      expect(EventSourceMock).toHaveBeenCalledTimes(1);
    });

    it('should close SSE connection', () => {
      const onUpdate = jest.fn();

      // Mock EventSource
      const mockEventSource = {
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        readyState: 1,
        CONNECTING: 0,
        OPEN: 1,
        CLOSED: 2,
      };

      (global as any).EventSource = jest.fn().mockImplementation(() => mockEventSource);

      configClient.watchConfig(onUpdate);
      configClient.close();

      expect(mockEventSource.close).toHaveBeenCalled();
    });
  });
});
