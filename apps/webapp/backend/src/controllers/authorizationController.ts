import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { authorizationService } from '../services/authorizationService.js';

export const authorizationController = {
  async getRoles(req: AuthRequest, res: Response) {
    try {
      const roles = await authorizationService.getRoles();
      res.json(roles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRoleById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const role = await authorizationService.getRoleById(id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      res.json(role);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async createRole(req: AuthRequest, res: Response) {
    try {
      const role = await authorizationService.createRole(req.body);
      res.status(201).json(role);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateRole(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const role = await authorizationService.updateRole(id, req.body);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      res.json(role);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteRole(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await authorizationService.deleteRole(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getUsers(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const users = await authorizationService.getUsers(organizationId);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async createUser(req: AuthRequest, res: Response) {
    try {
      const { email, password, name, role } = req.body;
      if (!email || !password || !name || !role) {
        return res.status(400).json({ error: 'Email, password, name and role are required' });
      }
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create users' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const organizationId = req.user.organization_id;
      const user = await authorizationService.createUser({
        email,
        password,
        name,
        role,
        organization_id: organizationId,
      });
      res.status(201).json(user);
    } catch (error: any) {
      if (error.message === 'Email already exists') {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  },

  async getUserById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const user = await authorizationService.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getUsersByRole(req: AuthRequest, res: Response) {
    try {
      const { role } = req.params;
      const organizationId = req.user?.organization_id;
      if (!organizationId) {
        return res.status(401).json({ error: 'Organization not found' });
      }
      const users = await authorizationService.getUsersByRole(role, organizationId);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateUserRole(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update user roles' });
      }
      const user = await authorizationService.updateUserRole(userId, role);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
