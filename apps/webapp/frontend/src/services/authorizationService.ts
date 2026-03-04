import type { Role, User } from '../types';
import { mockRoles } from '../utils/mockData';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getAuthHeaders() {
  const token = localStorage.getItem('jwt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const authorizationService = {
  async getRoles(): Promise<Role[]> {
    return mockRoles;
  },

  async getRoleById(id: string): Promise<Role | undefined> {
    return mockRoles.find((r) => r.id === id);
  },

  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/authorization/users`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async getUserById(id: string): Promise<User | undefined> {
    const res = await fetch(`${API_BASE}/authorization/users/${id}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) return undefined;
    return res.json();
  },

  async getUsersByRole(role: string): Promise<User[]> {
    const res = await fetch(`${API_BASE}/authorization/users/role/${role}`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('Failed to fetch users by role');
    return res.json();
  },

  async createRole(role: Omit<Role, 'id' | 'created_at'>): Promise<Role> {
    const newRole: Role = {
      ...role,
      id: `role-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    return newRole;
  },

  async updateRole(id: string, updates: Partial<Role>): Promise<Role> {
    const role = mockRoles.find((r) => r.id === id);
    if (role) return { ...role, ...updates };
    throw new Error('Role not found');
  },

  async deleteRole(id: string): Promise<void> {
    return;
  },

  async updateUserRole(userId: string, role: string): Promise<User> {
    const res = await fetch(`${API_BASE}/authorization/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error('Failed to update user role');
    return res.json();
  },

  async createUser(data: {
    email: string;
    password: string;
    name: string;
    role: string;
  }): Promise<User> {
    const res = await fetch(`${API_BASE}/authorization/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Failed to create user');
    return json;
  },
};
