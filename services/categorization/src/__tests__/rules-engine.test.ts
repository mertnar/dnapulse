import { RulesEngine } from '../rules-engine';
import { CategorizationConfig, Event } from '../types';

describe('RulesEngine', () => {
  let rulesEngine: RulesEngine;

  beforeEach(() => {
    rulesEngine = new RulesEngine();
  });

  describe('loadRules', () => {
    it('should load and sort rules by priority', () => {
      const config: CategorizationConfig = {
        rules: [
          {
            id: 'rule1',
            name: 'High Priority Rule',
            condition: 'type === "metric"',
            labels: ['high-priority'],
            priority: 1,
            enabled: true,
          },
          {
            id: 'rule2',
            name: 'Low Priority Rule',
            condition: 'type === "log"',
            labels: ['low-priority'],
            priority: 10,
            enabled: true,
          },
        ],
        metadata: {
          version: '1.0.0',
          updated_at: '2025-01-01T00:00:00Z',
          updated_by: 'test',
        },
      };

      rulesEngine.loadRules(config);
      const rules = rulesEngine.getRules();

      expect(rules).toHaveLength(2);
      expect(rules[0].id).toBe('rule1'); // Higher priority (lower number)
      expect(rules[1].id).toBe('rule2');
    });

    it('should filter out disabled rules', () => {
      const config: CategorizationConfig = {
        rules: [
          {
            id: 'rule1',
            name: 'Enabled Rule',
            condition: 'type === "metric"',
            labels: ['enabled'],
            priority: 1,
            enabled: true,
          },
          {
            id: 'rule2',
            name: 'Disabled Rule',
            condition: 'type === "log"',
            labels: ['disabled'],
            priority: 2,
            enabled: false,
          },
        ],
        metadata: {
          version: '1.0.0',
          updated_at: '2025-01-01T00:00:00Z',
          updated_by: 'test',
        },
      };

      rulesEngine.loadRules(config);
      const rules = rulesEngine.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('rule1');
    });
  });

  describe('evaluateEvent', () => {
    beforeEach(() => {
      const config: CategorizationConfig = {
        rules: [
          {
            id: 'cpu-rule',
            name: 'High CPU Usage',
            condition: 'payload.name === "cpu_usage" && payload.value > 80',
            labels: ['high-cpu', 'alert'],
            priority: 1,
            enabled: true,
          },
          {
            id: 'memory-rule',
            name: 'Memory Usage',
            condition: 'payload.name === "memory_usage" && payload.value > 90',
            labels: ['high-memory', 'critical'],
            priority: 2,
            enabled: true,
          },
          {
            id: 'error-rule',
            name: 'Error Logs',
            condition: 'type === "log" && payload.level === "error"',
            labels: ['error', 'alert'],
            priority: 3,
            enabled: true,
          },
        ],
        metadata: {
          version: '1.0.0',
          updated_at: '2025-01-01T00:00:00Z',
          updated_by: 'test',
        },
      };

      rulesEngine.loadRules(config);
    });

    it('should evaluate metric event and return matching labels', () => {
      const event: Event = {
        event_id: 'evt-123',
        source: 'test-server',
        type: 'metric',
        ts: '2025-01-01T00:00:00Z',
        attributes: {
          host: 'server1',
          region: 'us-east-1',
        },
        metric: {
          name: 'cpu_usage',
          value: 85.5,
          unit: 'percent',
        },
      };

      const labels = rulesEngine.evaluateEvent(event);

      expect(labels).toContain('high-cpu');
      expect(labels).toContain('alert');
      expect(labels).not.toContain('high-memory');
      expect(labels).not.toContain('error');
    });

    it('should evaluate log event and return matching labels', () => {
      const event: Event = {
        event_id: 'evt-124',
        source: 'test-app',
        type: 'log',
        ts: '2025-01-01T00:00:00Z',
        attributes: {
          service: 'web-app',
          version: '1.0.0',
        },
        log: {
          message: 'Database connection failed',
          level: 'error',
        },
      };

      const labels = rulesEngine.evaluateEvent(event);

      expect(labels).toContain('error');
      expect(labels).toContain('alert');
      expect(labels).not.toContain('high-cpu');
      expect(labels).not.toContain('high-memory');
    });

    it('should return empty array when no rules match', () => {
      const event: Event = {
        event_id: 'evt-125',
        source: 'test-server',
        type: 'metric',
        ts: '2025-01-01T00:00:00Z',
        attributes: {},
        metric: {
          name: 'disk_usage',
          value: 50.0,
          unit: 'percent',
        },
      };

      const labels = rulesEngine.evaluateEvent(event);

      expect(labels).toHaveLength(0);
    });

    it('should handle multiple matching rules', () => {
      const event: Event = {
        event_id: 'evt-126',
        source: 'test-server',
        type: 'metric',
        ts: '2025-01-01T00:00:00Z',
        attributes: {},
        metric: {
          name: 'cpu_usage',
          value: 95.0,
          unit: 'percent',
        },
      };

      const labels = rulesEngine.evaluateEvent(event);

      expect(labels).toContain('high-cpu');
      expect(labels).toContain('alert');
      // Should not have duplicates
      expect(labels.filter((label) => label === 'alert')).toHaveLength(1);
    });

    it('should handle invalid condition gracefully', () => {
      const config: CategorizationConfig = {
        rules: [
          {
            id: 'invalid-rule',
            name: 'Invalid Rule',
            condition: 'invalid syntax &&',
            labels: ['invalid'],
            priority: 1,
            enabled: true,
          },
          {
            id: 'valid-rule',
            name: 'Valid Rule',
            condition: 'type === "metric"',
            labels: ['valid'],
            priority: 2,
            enabled: true,
          },
        ],
        metadata: {
          version: '1.0.0',
          updated_at: '2025-01-01T00:00:00Z',
          updated_by: 'test',
        },
      };

      rulesEngine.loadRules(config);

      const event: Event = {
        event_id: 'evt-127',
        source: 'test-server',
        type: 'metric',
        ts: '2025-01-01T00:00:00Z',
        attributes: {},
        metric: {
          name: 'cpu_usage',
          value: 85.0,
          unit: 'percent',
        },
      };

      const labels = rulesEngine.evaluateEvent(event);

      // Should only return labels from valid rule
      expect(labels).toContain('valid');
      expect(labels).not.toContain('invalid');
    });
  });

  describe('context creation', () => {
    it('should create proper evaluation context for metric events', () => {
      const event: Event = {
        event_id: 'evt-128',
        source: 'test-server',
        type: 'metric',
        ts: '2025-01-01T00:00:00Z',
        attributes: {
          host: 'server1',
          region: 'us-east-1',
        },
        metric: {
          name: 'cpu_usage',
          value: 85.0,
          unit: 'percent',
        },
      };

      const config: CategorizationConfig = {
        rules: [
          {
            id: 'context-test',
            name: 'Context Test',
            condition:
              'attributes.host === "server1" && payload.name === "cpu_usage" && type === "metric"',
            labels: ['context-match'],
            priority: 1,
            enabled: true,
          },
        ],
        metadata: {
          version: '1.0.0',
          updated_at: '2025-01-01T00:00:00Z',
          updated_by: 'test',
        },
      };

      rulesEngine.loadRules(config);
      const labels = rulesEngine.evaluateEvent(event);

      expect(labels).toContain('context-match');
    });

    it('should create proper evaluation context for log events', () => {
      const event: Event = {
        event_id: 'evt-129',
        source: 'test-app',
        type: 'log',
        ts: '2025-01-01T00:00:00Z',
        attributes: {
          service: 'web-app',
          version: '1.0.0',
        },
        log: {
          message: 'User login successful',
          level: 'info',
        },
      };

      const config: CategorizationConfig = {
        rules: [
          {
            id: 'log-context-test',
            name: 'Log Context Test',
            condition:
              'attributes.service === "web-app" && payload.level === "info" && type === "log"',
            labels: ['log-context-match'],
            priority: 1,
            enabled: true,
          },
        ],
        metadata: {
          version: '1.0.0',
          updated_at: '2025-01-01T00:00:00Z',
          updated_by: 'test',
        },
      };

      rulesEngine.loadRules(config);
      const labels = rulesEngine.evaluateEvent(event);

      expect(labels).toContain('log-context-match');
    });
  });
});
