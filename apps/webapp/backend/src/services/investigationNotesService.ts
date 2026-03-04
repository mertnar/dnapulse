import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';

export interface InvestigationNote {
  id?: string;
  organization_id: string;
  investigation_id: string;
  author_id: string;
  author_email: string;
  text: string;
  created_at?: Date;
}

export const investigationNotesService = {
  async getByInvestigationId(
    investigationId: string,
    organizationId: string
  ): Promise<InvestigationNote[]> {
    try {
      const collection = await getCollection(Collections.INVESTIGATION_NOTES);
      const notes = await collection
        .find({
          investigation_id: new ObjectId(investigationId),
          organization_id: new ObjectId(organizationId),
        })
        .sort({ created_at: -1 })
        .toArray();

      return notes.map((note) => ({
        id: note._id.toString(),
        organization_id: note.organization_id.toString(),
        investigation_id: note.investigation_id.toString(),
        author_id: note.author_id,
        author_email: note.author_email,
        text: note.text,
        created_at: note.created_at,
      }));
    } catch (error) {
      console.error('Error fetching investigation notes:', error);
      return [];
    }
  },

  async create(note: Omit<InvestigationNote, 'id' | 'created_at'>): Promise<InvestigationNote> {
    try {
      const collection = await getCollection(Collections.INVESTIGATION_NOTES);
      const now = new Date();

      const doc = {
        organization_id: new ObjectId(note.organization_id),
        investigation_id: new ObjectId(note.investigation_id),
        author_id: note.author_id,
        author_email: note.author_email,
        text: note.text,
        created_at: now,
      };

      const result = await collection.insertOne(doc);

      return {
        ...note,
        id: result.insertedId.toString(),
        created_at: now,
      };
    } catch (error) {
      console.error('Error creating investigation note:', error);
      throw error;
    }
  },

  async delete(id: string, organizationId: string): Promise<boolean> {
    try {
      const collection = await getCollection(Collections.INVESTIGATION_NOTES);
      const result = await collection.deleteOne({
        _id: new ObjectId(id),
        organization_id: new ObjectId(organizationId),
      });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting investigation note:', error);
      return false;
    }
  },
};
