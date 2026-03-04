import { Request, Response } from 'express';
import { authService } from '../services/authService.js';

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, company_name, organization_id } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password and name are required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      const result = await authService.register({
        email,
        password,
        name,
        company_name,
        organization_id,
      });
      return res.status(201).json(result);
    } catch (err: any) {
      if (err.message === 'Email already registered') {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message || 'Registration failed' });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const result = await authService.login({ email, password });
      return res.json(result);
    } catch (err: any) {
      if (err.message === 'Invalid email or password') {
        return res.status(401).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message || 'Login failed' });
    }
  },
};
