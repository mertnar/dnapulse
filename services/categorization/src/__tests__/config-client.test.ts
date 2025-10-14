import axios from 'axios';
import { ConfigClient } from '../config-client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock EventSource
global.EventSource = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  onmessage: null,
  onerror: null,
  onopen: null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
  readyState: 1,
  url: '',
  withCredentials: false,
}));

describe('ConfigClient', () => {
  let configClient: ConfigClient;

  beforeEach(() => {
    configClient = new ConfigClient('http://localhost:8080');
    jest.clearAllMocks();
  });

  describe('load', () => {
    it('should load config successfully', async () => {
      const mockResponse = {
        data: 'rules:\n  - id: test-rule\n    condition: "true"',
        headers: { etag: 'test-etag' },
        status: 200
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await configClient.load('test-scope');

      expect(result).toEqual({
        yaml: 'rules:\n  - id: test-rule\n    condition: "true"',
        etag: 'test-etag',
        status: 200
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8080/v1/config/test-scope',
        { headers: {}, validateStatus: expect.any(Function) }
      );
    });

    it('should load config with etag', async () => {
      const mockResponse = {
        data: 'rules:\n  - id: test-rule\n    condition: "true"',
        headers: { etag: 'new-etag' },
        status: 200
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await configClient.load('test-scope', 'old-etag');

      expect(result.etag).toBe('new-etag');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8080/v1/config/test-scope',
        { 
          headers: { 'If-None-Match': 'old-etag' }, 
          validateStatus: expect.any(Function) 
        }
      );
    });

    it('should handle 304 Not Modified response', async () => {
      const mockResponse = {
        data: '',
        headers: {},
        status: 304
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await configClient.load('test-scope', 'current-etag');

      expect(result.status).toBe(304);
      expect(result.yaml).toBe('');
    });

    it('should handle axios errors', async () => {
      const error = new Error('Network error');
      mockedAxios.get.mockRejectedValue(error);

      await expect(configClient.load('test-scope')).rejects.toThrow('Config load failed: Network error');
    });

    it('should handle non-axios errors', async () => {
      const error = new Error('Unknown error');
      mockedAxios.isAxiosError = jest.fn().mockReturnValue(false);
      mockedAxios.get.mockRejectedValue(error);

      await expect(configClient.load('test-scope')).rejects.toThrow('Unknown error');
    });
  });

  describe('watchSSE', () => {
    it('should create EventSource and handle messages', () => {
      const onUpdate = jest.fn();
      const mockEventSource = {
        close: jest.fn(),
        onmessage: null,
        onerror: null,
        onopen: null,
      };

      (global.EventSource as jest.Mock).mockImplementation(() => mockEventSource);

      const eventSource = configClient.watchSSE('http://localhost:8080', onUpdate);

      expect(global.EventSource).toHaveBeenCalledWith('http://localhost:8080/v1/stream');
      expect(eventSource).toBe(mockEventSource);

      // Simulate message event
      const messageEvent = {
        data: JSON.stringify({ scope: 'test-scope', etag: 'new-etag' })
      };

      // Trigger onmessage handler
      if (mockEventSource.onmessage) {
        mockEventSource.onmessage(messageEvent);
      }

      expect(onUpdate).toHaveBeenCalledWith('test-scope', 'new-etag');
    });

    it('should handle invalid JSON in SSE messages', () => {
      const onUpdate = jest.fn();
      const mockEventSource = {
        close: jest.fn(),
        onmessage: null,
        onerror: jest.fn(),
        onopen: null,
      };

      (global.EventSource as jest.Mock).mockImplementation(() => mockEventSource);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      configClient.watchSSE('http://localhost:8080', onUpdate);

      // Simulate message with invalid JSON
      const messageEvent = {
        data: 'invalid json'
      };

      if (mockEventSource.onmessage) {
        mockEventSource.onmessage(messageEvent);
      }

      expect(onUpdate).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse SSE message:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle SSE errors with auto-reconnect', () => {
      const onUpdate = jest.fn();
      const mockEventSource = {
        close: jest.fn(),
        onmessage: null,
        onerror: null,
        onopen: null,
      };

      (global.EventSource as jest.Mock).mockImplementation(() => mockEventSource);

      jest.useFakeTimers();

      configClient.watchSSE('http://localhost:8080', onUpdate);

      // Simulate error
      const errorEvent = new Error('Connection failed');
      if (mockEventSource.onerror) {
        mockEventSource.onerror(errorEvent);
      }

      // Fast-forward timer
      jest.advanceTimersByTime(5000);

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(global.EventSource).toHaveBeenCalledTimes(2); // Initial + reconnect

      jest.useRealTimers();
    });
  });
});
