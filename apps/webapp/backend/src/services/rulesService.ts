import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export interface DetectionRule {
  id?: string;
  organization_id: string;
  name: string;
  query: string;
  condition: {
    type: 'count' | 'unique' | 'rate';
    field?: string;
    threshold: number;
    time_window_min: number;
  };
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  tags: string[];
  enabled: boolean;
  schedule_sec?: number; // default 60
  cooldown_min?: number; // default 5
  last_run_at?: Date;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
}

export const rulesService = {
  async getAll(organizationId: string): Promise<DetectionRule[]> {
    const collection = await getCollection(Collections.RULES);
    const rules = await collection
      .find({ organization_id: new ObjectId(organizationId) })
      .sort({ created_at: -1 })
      .toArray();

    return rules.map((r) => ({
      id: r._id.toString(),
      organization_id: r.organization_id.toString(),
      name: r.name,
      query: r.query,
      condition: r.condition,
      severity: r.severity,
      tags: r.tags || [],
      enabled: r.enabled,
      schedule_sec: r.schedule_sec || 60,
      cooldown_min: r.cooldown_min || 5,
      last_run_at: r.last_run_at,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  },

  async getById(id: string, organizationId: string): Promise<DetectionRule | null> {
    const collection = await getCollection(Collections.RULES);
    const rule = await collection.findOne({
      _id: new ObjectId(id),
      organization_id: new ObjectId(organizationId),
    });

    if (!rule) return null;

    return {
      id: rule._id.toString(),
      organization_id: rule.organization_id.toString(),
      name: rule.name,
      query: rule.query,
      condition: rule.condition,
      severity: rule.severity,
      tags: rule.tags || [],
      enabled: rule.enabled,
      schedule_sec: rule.schedule_sec || 60,
      cooldown_min: rule.cooldown_min || 5,
      last_run_at: rule.last_run_at,
      created_by: rule.created_by,
      created_at: rule.created_at,
      updated_at: rule.updated_at,
    };
  },

  async create(
    rule: Omit<DetectionRule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<DetectionRule> {
    const collection = await getCollection(Collections.RULES);
    const now = new Date();

    const doc = {
      organization_id: new ObjectId(rule.organization_id),
      name: rule.name,
      query: rule.query,
      condition: rule.condition,
      severity: rule.severity,
      tags: rule.tags || [],
      enabled: rule.enabled,
      schedule_sec: rule.schedule_sec || 60,
      cooldown_min: rule.cooldown_min || 5,
      last_run_at: null,
      created_by: rule.created_by,
      created_at: now,
      updated_at: now,
    };

    const result = await collection.insertOne(doc);

    return {
      ...rule,
      id: result.insertedId.toString(),
      created_at: now,
      updated_at: now,
    };
  },

  async update(
    id: string,
    organizationId: string,
    updates: Partial<DetectionRule>
  ): Promise<DetectionRule | null> {
    const collection = await getCollection(Collections.RULES);

    const updateDoc: any = { updated_at: new Date() };
    if (updates.name) updateDoc.name = updates.name;
    if (updates.query) updateDoc.query = updates.query;
    if (updates.condition) updateDoc.condition = updates.condition;
    if (updates.severity) updateDoc.severity = updates.severity;
    if (updates.tags) updateDoc.tags = updates.tags;
    if (updates.enabled !== undefined) updateDoc.enabled = updates.enabled;
    if (updates.schedule_sec) updateDoc.schedule_sec = updates.schedule_sec;
    if (updates.cooldown_min) updateDoc.cooldown_min = updates.cooldown_min;

    await collection.updateOne(
      { _id: new ObjectId(id), organization_id: new ObjectId(organizationId) },
      { $set: updateDoc }
    );

    return this.getById(id, organizationId);
  },

  async delete(id: string, organizationId: string): Promise<boolean> {
    const collection = await getCollection(Collections.RULES);
    const result = await collection.deleteOne({
      _id: new ObjectId(id),
      organization_id: new ObjectId(organizationId),
    });
    return result.deletedCount > 0;
  },

  async updateLastRun(id: string): Promise<void> {
    const collection = await getCollection(Collections.RULES);
    await collection.updateOne({ _id: new ObjectId(id) }, { $set: { last_run_at: new Date() } });
  },
};
