import type { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from '../crypto/sessionToken.js';

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-change-in-production';

export function validateSession(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-session-token'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'missing_session_token' });
    return;
  }

  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.socket.remoteAddress || '';

  const result = validateSessionToken(token, userAgent, ip, HMAC_SECRET);
  if (!result.valid) {
    res.status(401).json({ error: result.error });
    return;
  }

  // Attach session payload to request for downstream use
  (req as any).session = result.payload;
  next();
}
