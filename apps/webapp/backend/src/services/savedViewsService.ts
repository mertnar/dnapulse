import { getCollection, Collections } from '../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export interface SavedView {
  id?: string;
  _id?: ObjectId;
  organization_id: string;
  name: string;
  description?: string;
  query: string;
  time_preset?: string;
  selected_columns: string[];
  pinned_filters: Record<string, any>;
  datasource_scope?: string[];
  created_at?: Date;
  updated_at?: Date;
  created_by?: string;
}

export const savedViewsService = {
  /**
   * Create a new saved view
   */
  async createView(view: SavedView): Promise<SavedView> {
    const collection = await getCollection(Collections.LIVE_MONITOR_VIEWS);

    const newView = {
      ...view,
      organization_id: new ObjectId(view.organization_id),
      datasource_scope: view.datasource_scope?.map((id) => new ObjectId(id)),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await collection.insertOne(newView);

    return {
      ...view,
      id: result.insertedId.toString(),
      created_at: newView.created_at,
      updated_at: newView.updated_at,
    };
  },

  /**
   * Get all saved views for an organization
   */
  async getViews(organization_id: string): Promise<SavedView[]> {
    const collection = await getCollection(Collections.LIVE_MONITOR_VIEWS);

    const views = await collection
      .find({ organization_id: new ObjectId(organization_id) })
      .sort({ updated_at: -1 })
      .toArray();

    return views.map((v) => ({
      id: v._id.toString(),
      organization_id: v.organization_id.toString(),
      name: v.name,
      description: v.description,
      query: v.query,
      time_preset: v.time_preset,
      selected_columns: v.selected_columns,
      pinned_filters: v.pinned_filters,
      datasource_scope: v.datasource_scope?.map((id: ObjectId) => id.toString()),
      created_at: v.created_at,
      updated_at: v.updated_at,
      created_by: v.created_by,
    }));
  },

  /**
   * Get a saved view by ID
   */
  async getViewById(id: string): Promise<SavedView | null> {
    const collection = await getCollection(Collections.LIVE_MONITOR_VIEWS);

    const view = await collection.findOne({ _id: new ObjectId(id) });

    if (!view) {
      return null;
    }

    return {
      id: view._id.toString(),
      organization_id: view.organization_id.toString(),
      name: view.name,
      description: view.description,
      query: view.query,
      time_preset: view.time_preset,
      selected_columns: view.selected_columns,
      pinned_filters: view.pinned_filters,
      datasource_scope: view.datasource_scope?.map((id: ObjectId) => id.toString()),
      created_at: view.created_at,
      updated_at: view.updated_at,
      created_by: view.created_by,
    };
  },

  /**
   * Update a saved view
   */
  async updateView(id: string, updates: Partial<SavedView>): Promise<SavedView | null> {
    const collection = await getCollection(Collections.LIVE_MONITOR_VIEWS);

    const updateData: any = {
      ...updates,
      updated_at: new Date(),
    };

    // Convert IDs
    if (updates.organization_id) {
      updateData.organization_id = new ObjectId(updates.organization_id);
    }
    if (updates.datasource_scope) {
      updateData.datasource_scope = updates.datasource_scope.map((id) => new ObjectId(id));
    }

    // Remove id from update data
    delete updateData.id;
    delete updateData._id;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      return null;
    }

    return {
      id: result._id.toString(),
      organization_id: result.organization_id.toString(),
      name: result.name,
      description: result.description,
      query: result.query,
      time_preset: result.time_preset,
      selected_columns: result.selected_columns,
      pinned_filters: result.pinned_filters,
      datasource_scope: result.datasource_scope?.map((id: ObjectId) => id.toString()),
      created_at: result.created_at,
      updated_at: result.updated_at,
      created_by: result.created_by,
    };
  },

  /**
   * Delete a saved view
   */
  async deleteView(id: string): Promise<boolean> {
    const collection = await getCollection(Collections.LIVE_MONITOR_VIEWS);

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    return result.deletedCount > 0;
  },
};
