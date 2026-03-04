import { api } from '../lib/api';

export interface DataModelIndex {
  id: string;
  name: string;
  index_name: string;
  type: string;
  status: string;
  agent_type?: string;
}

export const dataModelsService = {
  /**
   * Get all data models (with their ELK indices)
   */
  async getDataModels(): Promise<DataModelIndex[]> {
    try {
      const models = await api.get<any[]>('/data-models');
      return models.map((m) => ({
        id: m.id,
        name: m.name,
        index_name: m.elk?.index_name || '',
        type: m.type,
        status: m.status,
        agent_type: m.source?.agent_type,
      }));
    } catch (error) {
      console.error('Error fetching data models:', error);
      return [];
    }
  },

  /**
   * Get full data model by id
   */
  async getDataModelById(id: string): Promise<any | null> {
    try {
      return await api.get<any>(`/data-models/${id}`);
    } catch (error) {
      console.error('Error fetching data model by id:', error);
      return null;
    }
  },

  /**
   * Get model lineage
   */
  async getModelLineage(id: string): Promise<any> {
    try {
      return await api.get<any>(`/data-models/${id}/lineage`);
    } catch (error) {
      // Return empty lineage if not found
      return { sources: [], consumers: [], relationships: [] };
    }
  },

  /**
   * Placeholder notes API (no backend yet)
   */
  async getModelNotes(_id: string): Promise<any[]> {
    return [];
  },

  /**
   * Placeholder usage API (no backend yet)
   */
  async getModelUsage(_id: string): Promise<any> {
    return {
      rules: [],
      alerts_triggered: 0,
      investigations: [],
      ml_pipelines: [],
    };
  },

  /**
   * Placeholder contributors API (no backend yet)
   */
  async getModelContributors(_id: string): Promise<any[]> {
    return [];
  },

  /**
   * Placeholder versions API (no backend yet)
   */
  async getModelVersions(_id: string): Promise<any[]> {
    return [];
  },

  /**
   * Placeholder sample data API (no backend yet)
   */
  async getModelSampleData(_id: string): Promise<any[]> {
    return [];
  },

  async updateAttribute(_modelId: string, attrId: string, updates: Partial<any>): Promise<any> {
    // Backend has /data-models/attributes/:attrId
    return api.patch<any>(`/data-models/attributes/${attrId}`, updates);
  },

  async createDerivedAttribute(modelId: string, attribute: Omit<any, 'id'>): Promise<any> {
    return api.post<any>(`/data-models/${modelId}/attributes`, attribute);
  },

  async saveModelVersion(id: string, _notes: string[]): Promise<any> {
    // Backend createVersion does not accept body; ignore notes for now
    return api.post<any>(`/data-models/${id}/version`, {});
  },

  async getPipeline(id: string): Promise<any | null> {
    try {
      return await api.get<any>(`/data-models/${id}/pipeline`);
    } catch (error: any) {
      // 404 is expected when no pipeline exists yet - silently return null
      return null;
    }
  },

  async createDerivedModel(params: any): Promise<any> {
    return api.post<any>('/data-models/derived', params);
  },

  async createVectorModel(params: any): Promise<any> {
    return api.post<any>('/data-models/vector', params);
  },

  async addNote(note: any): Promise<any> {
    // No backend endpoint yet; return note with fake id/timestamp
    return {
      id: `note_${Date.now()}`,
      created_at: new Date().toISOString(),
      ...note,
    };
  },

  /**
   * Get active data model indices for index selection
   */
  async getActiveIndices(): Promise<DataModelIndex[]> {
    try {
      const models = await this.getDataModels();
      return models.filter((m) => m.status === 'active' && m.index_name);
    } catch (error) {
      console.error('Error fetching active indices:', error);
      return [];
    }
  },
};
