import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';
import type { UserDoc } from './authService.js';

export const authorizationService = {
  async getRoles(): Promise<any[]> {
    return [];
  },

  async getRoleById(id: string): Promise<any> {
    return null;
  },

  async createRole(data: any): Promise<any> {
    return { ...data, id: `role-${Date.now()}`, created_at: new Date().toISOString() };
  },

  async updateRole(id: string, updates: any): Promise<any> {
    return null;
  },

  async deleteRole(id: string): Promise<void> {
    // Mock implementation
  },

  async getUsers(organizationId: string): Promise<any[]> {
    const collection = await getCollection<UserDoc>(Collections.USERS);
    const users = await collection.find({ organization_id: organizationId }).toArray();
    return users.map((u) => ({
      id: (u._id as ObjectId).toString(),
      email: u.email,
      full_name: u.name,
      role: u.role,
      created_at: u.created_at,
    }));
  },

  async getUserById(id: string): Promise<any> {
    const collection = await getCollection<UserDoc>(Collections.USERS);
    const user = await collection.findOne({ _id: new ObjectId(id) });
    if (!user) return null;
    return {
      id: (user._id as ObjectId).toString(),
      email: user.email,
      full_name: user.name,
      role: user.role,
      organization_id: user.organization_id,
      created_at: user.created_at,
    };
  },

  async getUsersByRole(role: string, organizationId: string): Promise<any[]> {
    const collection = await getCollection<UserDoc>(Collections.USERS);
    const users = await collection
      .find({ organization_id: organizationId, role: role as any })
      .toArray();
    return users.map((u) => ({
      id: (u._id as ObjectId).toString(),
      email: u.email,
      full_name: u.name,
      role: u.role,
      created_at: u.created_at,
    }));
  },

  async updateUserRole(userId: string, role: string): Promise<any> {
    const collection = await getCollection<UserDoc>(Collections.USERS);
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { role: role as any } },
      { returnDocument: 'after' }
    );
    if (!result) return null;
    return {
      id: (result._id as ObjectId).toString(),
      email: result.email,
      full_name: result.name,
      role: result.role,
      created_at: result.created_at,
    };
  },

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role: string;
    organization_id: string;
  }): Promise<any> {
    const collection = await getCollection<UserDoc>(Collections.USERS);
    const existing = await collection.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      throw new Error('Email already exists');
    }
    const hashed = await bcrypt.hash(data.password, 10);
    const doc: UserDoc = {
      email: data.email.toLowerCase(),
      password: hashed,
      name: data.name.trim(),
      organization_id: data.organization_id,
      role: data.role as any,
      created_at: new Date().toISOString(),
    };
    const result = await collection.insertOne(doc as UserDoc);
    return {
      id: result.insertedId.toString(),
      email: doc.email,
      full_name: doc.name,
      role: doc.role,
      organization_id: doc.organization_id,
      created_at: doc.created_at,
    };
  },
};
