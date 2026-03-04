import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export function generateDevToken(organizationId: string = '6976ee903bd20e1f00bc5dd6'): string {
  const payload: JWTPayload = {
    user_id: 'dev-user-001',
    organization_id: organizationId,
    role: 'admin',
    email: 'dev@dnapulse.local',
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Usage: node -e "import('./dist/utils/devAuth.js').then(m => console.log('JWT Token:', m.generateDevToken()))"
// Or: npm run build && node dist/utils/devAuth.js
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('JWT Token:', generateDevToken());
}
