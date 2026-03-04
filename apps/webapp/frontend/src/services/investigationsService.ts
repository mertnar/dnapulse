import type { Investigation } from '../types';
import { supabase } from '../lib/supabase';

export const investigationsService = {
  async getInvestigations(): Promise<Investigation[]> {
    const { data, error } = await supabase
      .from('investigations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching investigations:', error);
      return [];
    }

    return data || [];
  },

  async getInvestigationById(id: string): Promise<Investigation | undefined> {
    const { data, error } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching investigation:', error);
      return undefined;
    }

    return data || undefined;
  },

  async getInvestigationsByStatus(status: Investigation['status']): Promise<Investigation[]> {
    const { data, error } = await supabase
      .from('investigations')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching investigations by status:', error);
      return [];
    }

    return data || [];
  },

  async getInvestigationsByOwner(ownerId: string): Promise<Investigation[]> {
    const { data, error } = await supabase
      .from('investigations')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching investigations by owner:', error);
      return [];
    }

    return data || [];
  },

  async createInvestigation(
    investigation: Omit<Investigation, 'id' | 'created_at'>
  ): Promise<Investigation | null> {
    const { data, error } = await supabase
      .from('investigations')
      .insert([investigation])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating investigation:', error);
      return null;
    }

    return data;
  },

  async updateInvestigation(
    id: string,
    updates: Partial<Investigation>
  ): Promise<Investigation | null> {
    const { data, error } = await supabase
      .from('investigations')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating investigation:', error);
      return null;
    }

    return data;
  },

  async deleteInvestigation(id: string): Promise<void> {
    const { error } = await supabase.from('investigations').delete().eq('id', id);

    if (error) {
      console.error('Error deleting investigation:', error);
    }
  },
};
