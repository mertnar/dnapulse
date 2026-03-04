import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  user_id: string;
  organization_id: string;
  role: 'admin' | 'analyst' | 'viewer';
  email: string;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const DEFAULT_DEV_USER: JWTPayload = {
  user_id: 'dev-user-001',
  organization_id: process.env.DEFAULT_ORG_ID || '6976ee903bd20e1f00bc5dd6',
  role: 'admin',
  email: 'dev@dnapulse.local',
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const isDevBypass = process.env.BYPASS_AUTH === 'true';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (isDevBypass) {
        req.user = DEFAULT_DEV_USER;
        return next();
      }
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional: Role-based access control
export const requireRole = (...allowedRoles: JWTPayload['role'][]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
