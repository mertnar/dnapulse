import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';
import bcrypt from 'bcryptjs';

export interface APIKey {
  id: string;
  name: string;
  key: string; // Only returned when creating, otherwise masked
  permissions: string[];
  created_at: string;
  last_used?: string;
  expires_at?: string;
  created_by: string;
}

const generateAPIKey = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `dna_${timestamp}_${random}`;
};

const apiKeysService = {
  async getAll(organizationId?: string): Promise<APIKey[]> {
    try {
      const collection = await getCollection(Collections.API_KEYS);
      const filter = organizationId ? { organization_id: new ObjectId(organizationId) } : {};
      const apiKeys = await collection.find(filter).toArray();

      return apiKeys.map((key) => ({
        id: key._id.toString(),
        name: key.name,
        key: key.key ? `${key.key.substring(0, 8)}...` : '***', // Mask the key
        permissions: key.permissions || [],
        created_at: key.created_at?.toISOString() || new Date().toISOString(),
        last_used: key.last_used?.toISOString(),
        expires_at: key.expires_at?.toISOString(),
        created_by: key.created_by?.toString() || '',
      }));
    } catch (error) {
      console.error('Failed to get API keys:', error);
      return [];
    }
  },

  async getById(id: string): Promise<APIKey | null> {
    try {
      const collection = await getCollection(Collections.API_KEYS);
      const apiKey = await collection.findOne({ _id: new ObjectId(id) });

      if (!apiKey) {
        return null;
      }

      return {
        id: apiKey._id.toString(),
        name: apiKey.name,
        key: apiKey.key ? `${apiKey.key.substring(0, 8)}...` : '***',
        permissions: apiKey.permissions || [],
        created_at: apiKey.created_at?.toISOString() || new Date().toISOString(),
        last_used: apiKey.last_used?.toISOString(),
        expires_at: apiKey.expires_at?.toISOString(),
        created_by: apiKey.created_by?.toString() || '',
      };
    } catch (error) {
      console.error('Failed to get API key by ID:', error);
      return null;
    }
  },

  async create(data: {
    name: string;
    organizationId: string;
    permissions?: string[];
    expiresAt?: Date;
    createdBy: string;
  }): Promise<{ apiKey: APIKey; plainKey: string }> {
    try {
      const collection = await getCollection(Collections.API_KEYS);

      // Generate plain API key
      const plainKey = generateAPIKey();

      // Hash the key
      const hashedKey = await bcrypt.hash(plainKey, 10);

      const doc = {
        organization_id: new ObjectId(data.organizationId),
        name: data.name,
        key: hashedKey, // Store hashed version
        permissions: data.permissions || ['register', 'ingest', 'read'],
        expires_at: data.expiresAt || null,
        created_by: new ObjectId(data.createdBy),
        created_at: new Date(),
        last_used: null,
      };

      const result = await collection.insertOne(doc);

      return {
        apiKey: {
          id: result.insertedId.toString(),
          name: data.name,
          key: plainKey, // Return plain key only once
          permissions: doc.permissions,
          created_at: doc.created_at.toISOString(),
          expires_at: data.expiresAt?.toISOString(),
          created_by: data.createdBy,
        },
        plainKey, // Return plain key for display
      };
    } catch (error) {
      console.error('Failed to create API key:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      const collection = await getCollection(Collections.API_KEYS);
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Failed to delete API key:', error);
      return false;
    }
  },

  async update(
    id: string,
    updates: {
      name?: string;
      permissions?: string[];
      expiresAt?: Date | null;
    }
  ): Promise<APIKey | null> {
    try {
      const collection = await getCollection(Collections.API_KEYS);

      const updateDoc: any = {};
      if (updates.name) updateDoc.name = updates.name;
      if (updates.permissions) updateDoc.permissions = updates.permissions;
      if (updates.expiresAt !== undefined) updateDoc.expires_at = updates.expiresAt;

      await collection.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

      return await this.getById(id);
    } catch (error) {
      console.error('Failed to update API key:', error);
      return null;
    }
  },
};

export { apiKeysService };
export default apiKeysService;
