import type {
  MLModelExtended,
  MLModelInputOutput,
  MLTrainingDetails,
  MLValidationMetrics,
  MLDeployment,
  MLRuntimeMetrics,
  MLModelVersionHistory,
  MLGovernanceNote,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getAuthHeaders() {
  const token = localStorage.getItem('jwt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const mlModelsService = {
  async getMLModels(): Promise<MLModelExtended[]> {
    try {
      const res = await fetch(`${API_BASE}/ml-models`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        console.warn('ML Models: API returned', res.status);
        return [];
      }
      return res.json();
    } catch (error) {
      console.error('Error fetching ML models:', error);
      return [];
    }
  },

  async getMLModelById(id: string): Promise<MLModelExtended | undefined> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${id}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return undefined;
      return res.json();
    } catch (error) {
      console.error('Error fetching ML model:', error);
      return undefined;
    }
  },

  async getModelInputOutput(modelId: string): Promise<MLModelInputOutput | undefined> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/input-output`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return undefined;
      return res.json();
    } catch {
      return undefined;
    }
  },

  async getTrainingDetails(modelId: string): Promise<MLTrainingDetails | undefined> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/training`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return undefined;
      return res.json();
    } catch {
      return undefined;
    }
  },

  async getValidationMetrics(modelId: string): Promise<MLValidationMetrics | undefined> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/validation`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return undefined;
      return res.json();
    } catch {
      return undefined;
    }
  },

  async getDeployment(modelId: string): Promise<MLDeployment | undefined> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/deployment`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return undefined;
      return res.json();
    } catch {
      return undefined;
    }
  },

  async getRuntimeMetrics(modelId: string): Promise<MLRuntimeMetrics | undefined> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/runtime`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return undefined;
      return res.json();
    } catch {
      return undefined;
    }
  },

  async getVersionHistory(modelId: string): Promise<MLModelVersionHistory[]> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/versions`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  },

  async getGovernanceNotes(modelId: string): Promise<MLGovernanceNote[]> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/governance-notes`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  },

  async addGovernanceNote(
    modelId: string,
    note: Omit<MLGovernanceNote, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MLGovernanceNote> {
    try {
      const res = await fetch(`${API_BASE}/ml-models/${modelId}/governance-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(note),
      });
      if (!res.ok) throw new Error('Failed to add note');
      return res.json();
    } catch (error) {
      console.error('Error adding governance note:', error);
      throw error;
    }
  },
};
