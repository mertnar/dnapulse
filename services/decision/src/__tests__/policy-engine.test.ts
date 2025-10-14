import { PolicyEngine } from '../engine/policy-engine';
import { PluginRegistry } from '../plugins/plugin-registry';
import { EvaluationContext, PolicyConfig } from '../types/policy';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;
  let pluginRegistry: PluginRegistry;

  beforeEach(() => {
    pluginRegistry = new PluginRegistry('http://localhost:9200');
    engine = new PolicyEngine(pluginRegistry);
  });

  describe('loadPolicies', () => {
    it('should load valid policies', () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'test-policy',
            when: 'type=="metric"',
            actions: [{ type: 'index-es', index: 'alerts' }]
          }
        ]
      };

      engine.loadPolicies(config);
      expect(engine.getPolicies()).toHaveLength(1);
    });

    it('should filter out invalid policy expressions', () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'valid-policy',
            when: 'type=="metric"',
            actions: []
          },
          {
            id: 'invalid-policy',
            when: 'invalid..expression',
            actions: []
          }
        ]
      };

      engine.loadPolicies(config);
      expect(engine.getPolicies()).toHaveLength(1);
      expect(engine.getPolicies()[0]?.id).toBe('valid-policy');
    });

    it('should load settings from config', () => {
      const config: PolicyConfig = {
        alerts: [],
        settings: {
          max_policies: 50,
          evaluation_timeout: 5000
        }
      };

      engine.loadPolicies(config);
      const stats = engine.getStats();
      expect(stats.settings.max_policies).toBe(50);
      expect(stats.settings.evaluation_timeout).toBe(5000);
    });
  });

  describe('evaluate', () => {
    beforeEach(() => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'high-cpu',
            when: 'type=="metric" && payload.name=="cpu_load" && payload.value>0.9',
            actions: [{ type: 'index-es', index: 'alerts' }]
          },
          {
            id: 'error-log',
            when: 'type=="log" && payload.level=="error"',
            actions: [{ type: 'webhook', url: 'http://test.local' }]
          }
        ],
        settings: {
          parallel_evaluation: false
        }
      };

      engine.loadPolicies(config);
    });

    it('should match policies correctly', async () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: { name: 'cpu_load', value: 0.95 }
      };

      const results = await engine.evaluate(context);
      
      expect(results).toHaveLength(2);
      expect(results[0]?.matched).toBe(true);
      expect(results[0]?.policyId).toBe('high-cpu');
      expect(results[1]?.matched).toBe(false);
    });

    it('should not match when conditions are not met', async () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: { name: 'cpu_load', value: 0.5 }
      };

      const results = await engine.evaluate(context);
      
      expect(results[0]?.matched).toBe(false);
    });

    it('should include execution time in results', async () => {
      const context: EvaluationContext = {
        type: 'metric',
        payload: { name: 'cpu_load', value: 0.95 }
      };

      const results = await engine.evaluate(context);
      
      expect(results[0]?.executionTime).toBeDefined();
      expect(results[0]?.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPolicy', () => {
    beforeEach(() => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'test-policy',
            when: 'type=="metric"',
            actions: []
          }
        ]
      };

      engine.loadPolicies(config);
    });

    it('should retrieve policy by ID', () => {
      const policy = engine.getPolicy('test-policy');
      expect(policy).toBeDefined();
      expect(policy?.id).toBe('test-policy');
    });

    it('should return undefined for non-existent policy', () => {
      const policy = engine.getPolicy('non-existent');
      expect(policy).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('should return engine statistics', () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'policy1',
            when: 'type=="metric"',
            actions: []
          }
        ],
        settings: {
          parallel_evaluation: true
        }
      };

      engine.loadPolicies(config);
      const stats = engine.getStats();

      expect(stats.totalPolicies).toBe(1);
      expect(stats.settings.parallel_evaluation).toBe(true);
      expect(stats.plugins).toBeDefined();
    });
  });
});

