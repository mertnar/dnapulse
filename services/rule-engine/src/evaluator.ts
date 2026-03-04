import { Db, ObjectId } from 'mongodb';
import { parseKQLQuery } from './queryParser.js';
import { AlertCreator } from './alertCreator.js';

export class RuleEvaluator {
  constructor(private db: Db) {}

  async evaluateAllRules() {
    const rulesCol = this.db.collection('rules');

    try {
      const organizations = await rulesCol.distinct('organization_id', { enabled: true });

      console.log(`📋 Found ${organizations.length} organizations with enabled rules`);

      for (const orgId of organizations) {
        await this.evaluateOrganizationRules(orgId);
      }
    } catch (error) {
      console.error('❌ Error evaluating all rules:', error);
      throw error;
    }
  }

  async evaluateOrganizationRules(organizationId: ObjectId) {
    const rulesCol = this.db.collection('rules');

    try {
      const rules = await rulesCol
        .find({
          organization_id: organizationId,
          enabled: true,
        })
        .toArray();

      console.log(
        `  🔍 Evaluating ${rules.length} rules for org ${organizationId.toString().slice(-6)}`
      );

      for (const rule of rules) {
        try {
          await this.evaluateRule(rule);

          // Update last_run_at
          await rulesCol.updateOne({ _id: rule._id }, { $set: { last_run_at: new Date() } });
        } catch (error) {
          console.error(`    ❌ Error evaluating rule ${rule.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`❌ Error evaluating organization rules:`, error);
      throw error;
    }
  }

  async evaluateRule(rule: any) {
    const eventsCol = this.db.collection('events');
    const now = new Date();
    const windowStart = new Date(now.getTime() - rule.condition.time_window_min * 60 * 1000);

    try {
      // Parse KQL query
      let kqlFilter = {};
      try {
        kqlFilter = rule.query ? parseKQLQuery(rule.query) : {};
      } catch (error) {
        console.error(`    ⚠️  Failed to parse query for rule ${rule.name}:`, error);
        return;
      }

      // Build filter
      const filter: any = {
        organization_id: rule.organization_id,
        'payload.@ts': {
          $gte: windowStart.toISOString(),
          $lte: now.toISOString(),
        },
      };

      // Merge KQL filter
      if (Object.keys(kqlFilter).length > 0) {
        Object.assign(filter, kqlFilter);
      }

      // Count matching events
      const count = await eventsCol.countDocuments(filter);

      console.log(`    📊 Rule "${rule.name}": ${count}/${rule.condition.threshold} matches`);

      if (count >= rule.condition.threshold) {
        // Check cooldown
        const alertsCol = this.db.collection('alerts');
        const cooldownStart = new Date(now.getTime() - (rule.cooldown_min || 5) * 60 * 1000);
        const recentAlert = await alertsCol.findOne({
          rule_id: rule._id,
          created_at: { $gte: cooldownStart },
        });

        if (recentAlert) {
          console.log(`    ⏸️  Rule "${rule.name}" in cooldown, skipping`);
          return;
        }

        // Get sample events (top 20)
        const sampleEvents = await eventsCol
          .find(filter)
          .sort({ 'payload.@ts': -1 })
          .limit(20)
          .toArray();

        // Create alert
        const alertCreator = new AlertCreator(this.db);
        await alertCreator.createAlert(rule, {
          window: { from: windowStart, to: now },
          match_count: count,
          sample_events: sampleEvents,
        });
      }
    } catch (error) {
      console.error(`    ❌ Error in rule evaluation:`, error);
      throw error;
    }
  }
}
