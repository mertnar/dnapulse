export const mlModelsService = {
  async getMLModels(): Promise<any[]> {
    return [];
  },

  async getMLModelById(id: string): Promise<any> {
    return null;
  },

  async getModelInputOutput(id: string): Promise<any> {
    return null;
  },

  async getTrainingDetails(id: string): Promise<any> {
    return null;
  },

  async getValidationMetrics(id: string): Promise<any> {
    return null;
  },

  async getDeployment(id: string): Promise<any> {
    return null;
  },

  async getRuntimeMetrics(id: string): Promise<any> {
    return null;
  },

  async getVersionHistory(id: string): Promise<any[]> {
    return [];
  },

  async getGovernanceNotes(id: string): Promise<any[]> {
    return [];
  },

  async addGovernanceNote(id: string, note: any): Promise<any> {
    return { ...note, id: `note-${Date.now()}`, created_at: new Date().toISOString() };
  },
};
