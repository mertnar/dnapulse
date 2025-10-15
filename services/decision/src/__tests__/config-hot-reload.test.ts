import { ConfigClient } from '../utils/config-client';
import { PolicyConfig } from '../types/policy';

// Mock axios and eventsource
jest.mock('axios');
jest.mock('eventsource');

describe('ConfigClient', () => {
  let client: ConfigClient;

  beforeEach(() => {
    client = new ConfigClient('http://localhost:8080');
  });

  afterEach(() => {
    client.close();
  });

  describe('fetchConfig', () => {
    it('should fetch config from service', async () => {
      const axios = require('axios');
      const mockConfig: PolicyConfig = {
        alerts: [
          {
            id: 'test',
            when: 'type=="metric"',
            actions: [],
          },
        ],
      };

      axios.get.mockResolvedValue({
        data: `alerts:\n  - id: test\n    when: 'type=="metric"'\n    actions: []`,
      });

      const config = await client.fetchConfig('decision');
      expect(config.alerts).toHaveLength(1);
      expect(config.alerts[0]?.id).toBe('test');
    });

    it('should throw error on fetch failure', async () => {
      const axios = require('axios');
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(async () => {
        await client.fetchConfig('decision');
      }).rejects.toThrow();
    });
  });

  describe('subscribeToUpdates', () => {
    it('should subscribe to SSE updates', () => {
      const EventSource = require('eventsource');
      const mockEventSource = {
        addEventListener: jest.fn(),
        close: jest.fn(),
        onerror: null,
      };

      EventSource.mockImplementation(() => mockEventSource);

      const onUpdate = jest.fn();
      const unsubscribe = client.subscribeToUpdates('decision', onUpdate);

      expect(EventSource).toHaveBeenCalledWith('http://localhost:8080/v1/stream');
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
        'connected',
        expect.any(Function)
      );
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
        'config:update',
        expect.any(Function)
      );
      expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
        'heartbeat',
        expect.any(Function)
      );

      unsubscribe();
      expect(mockEventSource.close).toHaveBeenCalled();
    });

    it('should call onUpdate when config updates', async () => {
      const EventSource = require('eventsource');
      const axios = require('axios');

      let configUpdateHandler: any;

      const mockEventSource = {
        addEventListener: jest.fn((event, handler) => {
          if (event === 'config:update') {
            configUpdateHandler = handler;
          }
        }),
        close: jest.fn(),
        onerror: null,
      };

      EventSource.mockImplementation(() => mockEventSource);
      axios.get.mockResolvedValue({
        data: `alerts:\n  - id: updated\n    when: 'type=="metric"'\n    actions: []`,
      });

      const onUpdate = jest.fn();
      client.subscribeToUpdates('decision', onUpdate);

      // Simulate config update event
      if (configUpdateHandler) {
        await configUpdateHandler({
          data: JSON.stringify({
            scope: 'decision',
            etag: 'new-etag',
            timestamp: new Date().toISOString(),
          }),
        });
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
