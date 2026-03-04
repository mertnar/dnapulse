import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getCollection, Collections } from '../lib/mongodb.js';
import type { JWTPayload } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || '6976ee903bd20e1f00bc5dd6';

export interface UserDoc {
  _id?: ObjectId;
  email: string;
  password: string;
  name: string;
  organization_id: string;
  role: JWTPayload['role'];
  created_at: string;
}

export const authService = {
  async register(data: {
    email: string;
    password: string;
    name: string;
    company_name?: string;
    organization_id?: string;
  }) {
    const usersCollection = await getCollection<UserDoc>(Collections.USERS);
    const existing = await usersCollection.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      throw new Error('Email already registered');
    }

    let orgId = data.organization_id || DEFAULT_ORG_ID;

    if (data.company_name) {
      const orgsCollection = await getCollection(Collections.ORGANIZATIONS);
      const orgDoc = {
        name: data.company_name.trim(),
        created_at: new Date().toISOString(),
        settings: {},
      };
      const orgResult = await orgsCollection.insertOne(orgDoc);
      orgId = orgResult.insertedId.toString();
    }

    const hashed = await bcrypt.hash(data.password, 10);
    const now = new Date().toISOString();
    const doc: UserDoc = {
      email: data.email.toLowerCase(),
      password: hashed,
      name: data.name.trim(),
      organization_id: orgId,
      role: 'admin',
      created_at: now,
    };
    const result = await usersCollection.insertOne(doc as UserDoc);
    const id = result.insertedId.toString();
    const payload: JWTPayload = {
      user_id: id,
      organization_id: doc.organization_id,
      role: doc.role,
      email: doc.email,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    let organizationName = 'DNA Pulse';
    if (data.company_name) {
      organizationName = data.company_name;
    } else {
      const orgsCollection = await getCollection(Collections.ORGANIZATIONS);
      const org = await orgsCollection.findOne({ _id: new ObjectId(orgId) });
      if (org && (org as any).name) {
        organizationName = (org as any).name;
      }
    }

    return {
      token,
      user: {
        id,
        email: doc.email,
        name: doc.name,
        role: doc.role,
        organization_id: doc.organization_id,
        organization_name: organizationName,
      },
    };
  },

  async login(data: { email: string; password: string }) {
    const collection = await getCollection<UserDoc>(Collections.USERS);
    const user = await collection.findOne({ email: data.email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid email or password');
    }
    const match = await bcrypt.compare(data.password, user.password);
    if (!match) {
      throw new Error('Invalid email or password');
    }
    const payload: JWTPayload = {
      user_id: (user._id as ObjectId).toString(),
      organization_id: user.organization_id,
      role: user.role,
      email: user.email,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    let organizationName = 'DNA Pulse';
    const orgsCollection = await getCollection(Collections.ORGANIZATIONS);
    const org = await orgsCollection.findOne({ _id: new ObjectId(user.organization_id) });
    if (org && (org as any).name) {
      organizationName = (org as any).name;
    }

    return {
      token,
      user: {
        id: (user._id as ObjectId).toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        organization_id: user.organization_id,
        organization_name: organizationName,
      },
    };
  },
};
