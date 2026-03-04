import { Db } from 'mongodb';
import { EntityExtractor } from './entityExtractor.js';

export class AlertCreator {
  constructor(private db: Db) {}

  async createAlert(
    rule: any,
    data: {
      window: { from: Date; to: Date };
      match_count: number;
      sample_events: any[];
    }
  ) {
    const alertsCol = this.db.collection('alerts');

    // Compute dedupe key: rule_id:bucket_start_iso
    const bucketStart = this.floorToWindow(data.window.from, rule.condition.time_window_min);
    const dedupeKey = `${rule._id.toString()}:${bucketStart.toISOString()}`;

    // Check if alert already exists
    try {
      const existing = await alertsCol.findOne({ dedupe_key: dedupeKey });
      if (existing) {
        console.log(`⏭️  Alert already exists for dedupe_key: ${dedupeKey}`);
        return;
      }
    } catch (error: any) {
      // If duplicate key error, alert already exists
      if (error.code === 11000) {
        console.log(`⏭️  Alert already exists (duplicate key): ${dedupeKey}`);
        return;
      }
      throw error;
    }

    // Extract entities
    const extractor = new EntityExtractor();
    const entities = extractor.extractFromEvents(data.sample_events);

    // Create alert
    const alert = {
      organization_id: rule.organization_id,
      rule_id: rule._id,
      rule_snapshot: {
        name: rule.name,
        query: rule.query,
        condition: rule.condition,
      },
      status: 'triggered',
      severity: rule.severity,
      title: `${rule.name} - ${data.match_count} matches`,
      description: `Rule triggered: ${data.match_count} events matched in ${rule.condition.time_window_min}m window`,
      window: data.window,
      match_count: data.match_count,
      sample_event_ids: data.sample_events.map((e) => e._id.toString()),
      entities,
      dedupe_key: dedupeKey,
      investigation_id: null,
      assigned_to: null,
      related_events: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    try {
      await alertsCol.insertOne(alert);
      console.log(`✅ Alert created: ${alert.title}`);
    } catch (error: any) {
      // If duplicate key error, alert was created by another instance
      if (error.code === 11000) {
        console.log(`⏭️  Alert already exists (race condition): ${dedupeKey}`);
        return;
      }
      throw error;
    }
  }

  private floorToWindow(date: Date, windowMin: number): Date {
    const ms = date.getTime();
    const windowMs = windowMin * 60 * 1000;
    return new Date(Math.floor(ms / windowMs) * windowMs);
  }
}
