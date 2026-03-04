import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'triggered' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

export interface Alert {
  id: string;
  organization_id: string;
  rule_id: string | null;
  rule_snapshot?: any; // Rule config at alert time
  source_id?: string | null;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string | null;
  window?: {
    from: Date | string;
    to: Date | string;
  };
  match_count?: number;
  sample_event_ids?: string[]; // limit 20
  entities?: {
    hosts: string[];
    users: string[];
    ips: string[];
  };
  dedupe_key?: string; // unique: rule_id:bucket_timestamp
  investigation_id?: string | null;
  related_events: any[];
  assigned_to: string | null;
  created_at: string;
  updated_at?: string;
  resolved_at: string | null;
}

const alertsService = {
  async getAll(
    organizationId?: string,
    status?: AlertStatus,
    severity?: AlertSeverity
  ): Promise<Alert[]> {
    try {
      const collection = await getCollection(Collections.ALERTS);
      const filter: any = {};

      if (organizationId) filter.organization_id = new ObjectId(organizationId);
      if (status) filter.status = status;
      if (severity) filter.severity = severity;

      const alerts = await collection.find(filter).sort({ created_at: -1 }).toArray();

      return alerts.map((alert) => ({
        id: alert._id.toString(),
        organization_id: alert.organization_id.toString(),
        rule_id: alert.rule_id?.toString() || null,
        source_id: alert.source_id?.toString() || null,
        severity: alert.severity as AlertSeverity,
        status: alert.status as AlertStatus,
        title: alert.title,
        description: alert.description || null,
        related_events: alert.related_events || [],
        assigned_to: alert.assigned_to?.toString() || null,
        created_at: alert.created_at?.toISOString() || new Date().toISOString(),
        resolved_at: alert.resolved_at?.toISOString() || null,
      }));
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return [];
    }
  },

  async getById(id: string): Promise<Alert | null> {
    try {
      const collection = await getCollection(Collections.ALERTS);
      const alert = await collection.findOne({ _id: new ObjectId(id) });

      if (!alert) return null;

      return {
        id: alert._id.toString(),
        organization_id: alert.organization_id.toString(),
        rule_id: alert.rule_id?.toString() || null,
        source_id: alert.source_id?.toString() || null,
        severity: alert.severity as AlertSeverity,
        status: alert.status as AlertStatus,
        title: alert.title,
        description: alert.description || null,
        related_events: alert.related_events || [],
        assigned_to: alert.assigned_to?.toString() || null,
        created_at: alert.created_at?.toISOString() || new Date().toISOString(),
        resolved_at: alert.resolved_at?.toISOString() || null,
      };
    } catch (error) {
      console.error('Error fetching alert:', error);
      return null;
    }
  },

  async create(alert: Omit<Alert, 'id' | 'created_at' | 'resolved_at'>): Promise<Alert> {
    try {
      const collection = await getCollection(Collections.ALERTS);
      const now = new Date();

      const doc = {
        organization_id: new ObjectId(alert.organization_id),
        rule_id: alert.rule_id ? new ObjectId(alert.rule_id) : null,
        source_id: alert.source_id ? new ObjectId(alert.source_id) : null,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        description: alert.description,
        related_events: alert.related_events || [],
        assigned_to: alert.assigned_to ? new ObjectId(alert.assigned_to) : null,
        created_at: now,
        resolved_at: null,
      };

      const result = await collection.insertOne(doc);

      return {
        ...alert,
        id: result.insertedId.toString(),
        created_at: now.toISOString(),
        resolved_at: null,
      };
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Alert>): Promise<Alert | null> {
    try {
      const collection = await getCollection(Collections.ALERTS);

      const updateDoc: any = {};
      if (updates.severity) updateDoc.severity = updates.severity;
      if (updates.status) {
        updateDoc.status = updates.status;
        if (updates.status === 'resolved' || updates.status === 'closed') {
          updateDoc.resolved_at = new Date();
        }
      }
      if (updates.title) updateDoc.title = updates.title;
      if (updates.description !== undefined) updateDoc.description = updates.description;
      if (updates.related_events) updateDoc.related_events = updates.related_events;
      if (updates.assigned_to) updateDoc.assigned_to = new ObjectId(updates.assigned_to);

      await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

      return await this.getById(id);
    } catch (error) {
      console.error('Error updating alert:', error);
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(Collections.ALERTS);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting alert:', error);
      return false;
    }
  },

  async getStats(organizationId?: string): Promise<{
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byStatus: Record<AlertStatus, number>;
  }> {
    try {
      const alerts = await this.getAll(organizationId);

      const stats = {
        total: alerts.length,
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        },
        byStatus: {
          triggered: 0,
          acknowledged: 0,
          in_progress: 0,
          resolved: 0,
          closed: 0,
        },
      };

      alerts.forEach((alert) => {
        stats.bySeverity[alert.severity]++;
        stats.byStatus[alert.status]++;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching alert stats:', error);
      return {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        byStatus: { triggered: 0, acknowledged: 0, in_progress: 0, resolved: 0, closed: 0 },
      };
    }
  },

  async updateStatus(
    id: string,
    organizationId: string,
    status: AlertStatus
  ): Promise<Alert | null> {
    try {
      const collection = await getCollection(Collections.ALERTS);

      const updateDoc: any = {
        status,
        updated_at: new Date(),
      };

      if (status === 'resolved' || status === 'closed') {
        updateDoc.resolved_at = new Date();
      }

      await collection.updateOne(
        { _id: new ObjectId(id), organization_id: new ObjectId(organizationId) },
        { $set: updateDoc }
      );

      return await this.getById(id);
    } catch (error) {
      console.error('Error updating alert status:', error);
      return null;
    }
  },

  async linkToInvestigation(
    id: string,
    organizationId: string,
    investigationId: string
  ): Promise<Alert | null> {
    try {
      const collection = await getCollection(Collections.ALERTS);

      await collection.updateOne(
        { _id: new ObjectId(id), organization_id: new ObjectId(organizationId) },
        { $set: { investigation_id: new ObjectId(investigationId), updated_at: new Date() } }
      );

      return await this.getById(id);
    } catch (error) {
      console.error('Error linking alert to investigation:', error);
      return null;
    }
  },

  async getByRuleId(ruleId: string, organizationId: string): Promise<Alert[]> {
    try {
      const collection = await getCollection(Collections.ALERTS);
      const alerts = await collection
        .find({
          rule_id: new ObjectId(ruleId),
          organization_id: new ObjectId(organizationId),
        })
        .sort({ created_at: -1 })
        .toArray();

      return alerts.map((alert) => ({
        id: alert._id.toString(),
        organization_id: alert.organization_id.toString(),
        rule_id: alert.rule_id?.toString() || null,
        rule_snapshot: alert.rule_snapshot,
        source_id: alert.source_id?.toString() || null,
        severity: alert.severity as AlertSeverity,
        status: alert.status as AlertStatus,
        title: alert.title,
        description: alert.description || null,
        window: alert.window,
        match_count: alert.match_count,
        sample_event_ids: alert.sample_event_ids || [],
        entities: alert.entities,
        dedupe_key: alert.dedupe_key,
        investigation_id: alert.investigation_id?.toString() || null,
        related_events: alert.related_events || [],
        assigned_to: alert.assigned_to?.toString() || null,
        created_at: alert.created_at?.toISOString() || new Date().toISOString(),
        updated_at: alert.updated_at?.toISOString(),
        resolved_at: alert.resolved_at?.toISOString() || null,
      }));
    } catch (error) {
      console.error('Error fetching alerts by rule:', error);
      return [];
    }
  },
};

export { alertsService };
export default alertsService;
