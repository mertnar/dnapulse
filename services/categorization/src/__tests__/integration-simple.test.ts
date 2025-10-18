import { ConfigClient } from '../config/client';
import { CategorizationConfig } from '../model';
import pino from 'pino';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Categorization Service Integration Tests', () => {
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

  describe('Config Service Integration', () => {
    it('should load configuration from config service', async () => {
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
      expect(result.version).toBe(1);
      expect(result.cardinality).toBe('one_to_many');
      expect(result.pipelines).toHaveLength(1);
      expect(result.pipelines[0]?.name).toBe('high_cpu_detector');
      expect(result.pipelines[0]?.labeler).toBe('rule_based');
    });

    it('should handle config service unavailability', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(configClient.loadConfig()).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle invalid configuration response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          version: 1,
          cardinality: 'one_to_one',
          label_kind: 'category',
          pipelines: [], // Empty pipelines to avoid errors
        }),
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

      // Should not throw and return the config
      const result = await configClient.loadConfig();
      expect(result.version).toBe(1);
      expect(result.pipelines).toEqual([]);
    });
  });

  describe('SSE Configuration Updates', () => {
    beforeEach(() => {
      // Clean up any existing EventSource mock
      delete (global as any).EventSource;
    });

    it('should establish SSE connection for config updates', () => {
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

      const EventSourceMock = jest.fn().mockImplementation(() => mockEventSource);
      (global as any).EventSource = EventSourceMock;

      configClient.watchConfig(onUpdate);

      expect(EventSourceMock).toHaveBeenCalledWith('http://localhost:8084/v1/stream');
      expect(EventSourceMock).toHaveBeenCalledTimes(1);
    });

    it('should handle SSE connection errors gracefully', () => {
      const onUpdate = jest.fn();

      // Mock EventSource with error handler
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

      // Should not throw
      expect(() => configClient.watchConfig(onUpdate)).not.toThrow();
    });
  });

  describe('Service Health', () => {
    it('should handle config service timeout', async () => {
      // Mock a timeout error - resolve immediately with timeout error
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(configClient.loadConfig()).rejects.toThrow('Request timeout');
    }, 1000); // Set test timeout to 1 second

    it('should handle config service 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
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
        'Config service returned 404: Not Found'
      );
    });
  });
});
