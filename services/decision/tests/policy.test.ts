"""Tests for decision service policy parsing and action dispatch."""

import { PolicyEngine } from '../src/engine/policy-engine';
import { PluginRegistry } from '../src/plugins/plugin-registry';
import { PolicyConfig, EvaluationContext } from '../src/types/policy';

describe('Decision Service Policy Tests', () => {
  let policyEngine: PolicyEngine;
  let pluginRegistry: PluginRegistry;

  beforeEach(() => {
    pluginRegistry = new PluginRegistry('http://localhost:9200');
    policyEngine = new PolicyEngine(pluginRegistry);
  });

  describe('Policy Parsing', () => {
    test('should parse policy config correctly', () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'test-policy-1',
            when: 'type == "error"',
            actions: [
              {
                type: 'index-es',
                config: {
                  index: 'alerts',
                  doc_type: 'alert'
                }
              }
            ]
          }
        ]
      };

      policyEngine.loadPolicies(config);

      const policies = policyEngine.getPolicies();
      expect(policies).toHaveLength(1);
      expect(policies[0].id).toBe('test-policy-1');
      expect(policies[0].condition).toBe('type == "error"');
      expect(policies[0].actions).toHaveLength(1);
      expect(policies[0].actions[0].type).toBe('index-es');
    });

    test('should handle empty policy config', () => {
      const config: PolicyConfig = {
        alerts: []
      };

      policyEngine.loadPolicies(config);

      const policies = policyEngine.getPolicies();
      expect(policies).toHaveLength(0);
    });

    test('should handle multiple policies', () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'policy-1',
            when: 'type == "error"',
            actions: [{ type: 'index-es', config: {} }]
          },
          {
            id: 'policy-2',
            when: 'attributes.severity == "critical"',
            actions: [{ type: 'webhook', config: { url: 'http://example.com' } }]
          }
        ]
      };

      policyEngine.loadPolicies(config);

      const policies = policyEngine.getPolicies();
      expect(policies).toHaveLength(2);
      expect(policies[0].id).toBe('policy-1');
      expect(policies[1].id).toBe('policy-2');
    });
  });

  describe('Action Dispatch', () => {
    test('should dispatch index-es action', async () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'index-action-test',
            when: 'type == "error"',
            actions: [
              {
                type: 'index-es',
                config: {
                  index: 'alerts',
                  doc_type: 'alert'
                }
              }
            ]
          }
        ]
      };

      policyEngine.loadPolicies(config);

      const context: EvaluationContext = {
        type: 'error',
        payload: { message: 'Test error' },
        attributes: {},
        ts: new Date().toISOString()
      };

      // Mock the plugin registry
      const mockPlugin = {
        execute: jest.fn().mockResolvedValue({ success: true })
      };
      jest.spyOn(pluginRegistry, 'getPlugin').mockReturnValue(mockPlugin);

      const results = await policyEngine.evaluate(context);

      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].actions).toHaveLength(1);
      expect(mockPlugin.execute).toHaveBeenCalledWith({
        type: 'index-es',
        config: {
          index: 'alerts',
          doc_type: 'alert'
        }
      }, context);
    });

    test('should dispatch webhook action', async () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'webhook-action-test',
            when: 'attributes.severity == "critical"',
            actions: [
              {
                type: 'webhook',
                config: {
                  url: 'http://example.com/webhook',
                  method: 'POST'
                }
              }
            ]
          }
        ]
      };

      policyEngine.loadPolicies(config);

      const context: EvaluationContext = {
        type: 'alert',
        payload: { message: 'Critical alert' },
        attributes: { severity: 'critical' },
        ts: new Date().toISOString()
      };

      // Mock the plugin registry
      const mockPlugin = {
        execute: jest.fn().mockResolvedValue({ success: true })
      };
      jest.spyOn(pluginRegistry, 'getPlugin').mockReturnValue(mockPlugin);

      const results = await policyEngine.evaluate(context);

      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].actions).toHaveLength(1);
      expect(mockPlugin.execute).toHaveBeenCalledWith({
        type: 'webhook',
        config: {
          url: 'http://example.com/webhook',
          method: 'POST'
        }
      }, context);
    });

    test('should handle multiple actions', async () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'multi-action-test',
            when: 'type == "error"',
            actions: [
              {
                type: 'index-es',
                config: { index: 'alerts' }
              },
              {
                type: 'webhook',
                config: { url: 'http://example.com' }
              }
            ]
          }
        ]
      };

      policyEngine.loadPolicies(config);

      const context: EvaluationContext = {
        type: 'error',
        payload: { message: 'Test error' },
        attributes: {},
        ts: new Date().toISOString()
      };

      // Mock the plugin registry
      const mockPlugin = {
        execute: jest.fn().mockResolvedValue({ success: true })
      };
      jest.spyOn(pluginRegistry, 'getPlugin').mockReturnValue(mockPlugin);

      const results = await policyEngine.evaluate(context);

      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
      expect(results[0].actions).toHaveLength(2);
      expect(mockPlugin.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('Condition Evaluation', () => {
    test('should evaluate simple conditions', async () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'condition-test',
            when: 'type == "error"',
            actions: [{ type: 'index-es', config: {} }]
          }
        ]
      };

      policyEngine.loadPolicies(config);

      // Test matching condition
      const matchingContext: EvaluationContext = {
        type: 'error',
        payload: {},
        attributes: {},
        ts: new Date().toISOString()
      };

      const results = await policyEngine.evaluate(matchingContext);
      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);

      // Test non-matching condition
      const nonMatchingContext: EvaluationContext = {
        type: 'info',
        payload: {},
        attributes: {},
        ts: new Date().toISOString()
      };

      const nonMatchingResults = await policyEngine.evaluate(nonMatchingContext);
      expect(nonMatchingResults).toHaveLength(1);
      expect(nonMatchingResults[0].matched).toBe(false);
    });

    test('should evaluate complex conditions', async () => {
      const config: PolicyConfig = {
        alerts: [
          {
            id: 'complex-condition-test',
            when: 'type == "error" && attributes.severity == "critical"',
            actions: [{ type: 'index-es', config: {} }]
          }
        ]
      };

      policyEngine.loadPolicies(config);

      const context: EvaluationContext = {
        type: 'error',
        payload: {},
        attributes: { severity: 'critical' },
        ts: new Date().toISOString()
      };

      const results = await policyEngine.evaluate(context);
      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe(true);
    });
  });
});

