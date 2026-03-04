import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export type InvestigationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type InvestigationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Investigation {
  id?: string;
  organization_id: string;
  title: string;
  status: InvestigationStatus;
  severity: InvestigationSeverity;
  alert_ids: string[];
  event_refs: Array<{ event_id: string }>;
  entities: {
    hosts: string[];
    users: string[];
    ips: string[];
  };
  assigned_to?: string | null;
  created_by: string;
  created_at?: Date;
  updated_at?: Date;
  closed_at?: Date | null;
}

export const investigationsService = {
  async getAll(organizationId: string, status?: InvestigationStatus): Promise<Investigation[]> {
    try {
      const collection = await getCollection(Collections.INVESTIGATIONS);
      const filter: any = { organization_id: new ObjectId(organizationId) };

      if (status) {
        filter.status = status;
      }

      const investigations = await collection.find(filter).sort({ updated_at: -1 }).toArray();

      return investigations.map((inv) => ({
        id: inv._id.toString(),
        organization_id: inv.organization_id.toString(),
        title: inv.title,
        status: inv.status,
        severity: inv.severity,
        alert_ids: (inv.alert_ids || []).map((id: any) => id.toString()),
        event_refs: inv.event_refs || [],
        entities: inv.entities || { hosts: [], users: [], ips: [] },
        assigned_to: inv.assigned_to?.toString() || null,
        created_by: inv.created_by,
        created_at: inv.created_at,
        updated_at: inv.updated_at,
        closed_at: inv.closed_at,
      }));
    } catch (error) {
      console.error('Error fetching investigations:', error);
      return [];
    }
  },

  async getById(id: string, organizationId: string): Promise<Investigation | null> {
    try {
      const collection = await getCollection(Collections.INVESTIGATIONS);
      const investigation = await collection.findOne({
        _id: new ObjectId(id),
        organization_id: new ObjectId(organizationId),
      });

      if (!investigation) return null;

      return {
        id: investigation._id.toString(),
        organization_id: investigation.organization_id.toString(),
        title: investigation.title,
        status: investigation.status,
        severity: investigation.severity,
        alert_ids: (investigation.alert_ids || []).map((id: any) => id.toString()),
        event_refs: investigation.event_refs || [],
        entities: investigation.entities || { hosts: [], users: [], ips: [] },
        assigned_to: investigation.assigned_to?.toString() || null,
        created_by: investigation.created_by,
        created_at: investigation.created_at,
        updated_at: investigation.updated_at,
        closed_at: investigation.closed_at,
      };
    } catch (error) {
      console.error('Error fetching investigation:', error);
      return null;
    }
  },

  async create(
    investigation: Omit<Investigation, 'id' | 'created_at' | 'updated_at' | 'closed_at'>
  ): Promise<Investigation> {
    try {
      const collection = await getCollection(Collections.INVESTIGATIONS);
      const now = new Date();

      const doc = {
        organization_id: new ObjectId(investigation.organization_id),
        title: investigation.title,
        status: investigation.status,
        severity: investigation.severity,
        alert_ids: investigation.alert_ids.map((id) => new ObjectId(id)),
        event_refs: investigation.event_refs || [],
        entities: investigation.entities || { hosts: [], users: [], ips: [] },
        assigned_to: investigation.assigned_to ? new ObjectId(investigation.assigned_to) : null,
        created_by: investigation.created_by,
        created_at: now,
        updated_at: now,
        closed_at: null,
      };

      const result = await collection.insertOne(doc);

      return {
        ...investigation,
        id: result.insertedId.toString(),
        created_at: now,
        updated_at: now,
        closed_at: null,
      };
    } catch (error) {
      console.error('Error creating investigation:', error);
      throw error;
    }
  },

  async update(
    id: string,
    organizationId: string,
    updates: Partial<Investigation>
  ): Promise<Investigation | null> {
    try {
      const collection = await getCollection(Collections.INVESTIGATIONS);

      const updateDoc: any = { updated_at: new Date() };

      if (updates.title) updateDoc.title = updates.title;
      if (updates.status) {
        updateDoc.status = updates.status;
        if (updates.status === 'resolved' || updates.status === 'closed') {
          updateDoc.closed_at = new Date();
        }
      }
      if (updates.severity) updateDoc.severity = updates.severity;
      if (updates.alert_ids) updateDoc.alert_ids = updates.alert_ids.map((id) => new ObjectId(id));
      if (updates.event_refs) updateDoc.event_refs = updates.event_refs;
      if (updates.entities) updateDoc.entities = updates.entities;
      if (updates.assigned_to !== undefined) {
        updateDoc.assigned_to = updates.assigned_to ? new ObjectId(updates.assigned_to) : null;
      }

      await collection.updateOne(
        { _id: new ObjectId(id), organization_id: new ObjectId(organizationId) },
        { $set: updateDoc }
      );

      return await this.getById(id, organizationId);
    } catch (error) {
      console.error('Error updating investigation:', error);
      return null;
    }
  },

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      const collection = await getCollection(Collections.INVESTIGATIONS);
      const result = await collection.deleteOne({
        _id: new ObjectId(id),
        organization_id: new ObjectId(organizationId),
      });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting investigation:', error);
      return false;
    }
  },

  async addAlert(
    investigationId: string,
    organizationId: string,
    alertId: string
  ): Promise<Investigation | null> {
    try {
      const collection = await getCollection(Collections.INVESTIGATIONS);

      await collection.updateOne(
        { _id: new ObjectId(investigationId), organization_id: new ObjectId(organizationId) },
        {
          $addToSet: { alert_ids: new ObjectId(alertId) },
          $set: { updated_at: new Date() },
        }
      );

      return await this.getById(investigationId, organizationId);
    } catch (error) {
      console.error('Error adding alert to investigation:', error);
      return null;
    }
  },

  async addEvents(
    investigationId: string,
    organizationId: string,
    eventIds: string[]
  ): Promise<Investigation | null> {
    try {
      const collection = await getCollection(Collections.INVESTIGATIONS);

      const eventRefs = eventIds.map((event_id) => ({ event_id }));

      await collection.updateOne(
        { _id: new ObjectId(investigationId), organization_id: new ObjectId(organizationId) },
        {
          $push: { event_refs: { $each: eventRefs } } as any,
          $set: { updated_at: new Date() },
        }
      );

      return await this.getById(investigationId, organizationId);
    } catch (error) {
      console.error('Error adding events to investigation:', error);
      return null;
    }
  },

  // Legacy methods for backward compatibility
  async getInvestigations(): Promise<any[]> {
    return [];
  },

  async getInvestigationById(id: string): Promise<any> {
    return null;
  },

  async getInvestigationsByStatus(status: string): Promise<any[]> {
    return [];
  },

  async getInvestigationsByOwner(ownerId: string): Promise<any[]> {
    return [];
  },

  async createInvestigation(data: any): Promise<any> {
    return { ...data, id: `inv-${Date.now()}`, created_at: new Date().toISOString() };
  },

  async updateInvestigation(id: string, updates: any): Promise<any> {
    return null;
  },

  async deleteInvestigation(id: string): Promise<void> {
    // Mock implementation
  },
};
