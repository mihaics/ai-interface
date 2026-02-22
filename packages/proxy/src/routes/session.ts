import { Router } from 'express';
import { createSessionToken } from '../crypto/sessionToken.js';

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-change-in-production';
const TOKEN_TTL_MS = 7_200_000; // 2 hours

export const sessionRouter = Router();

sessionRouter.post('/session', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.socket.remoteAddress || '';

  const token = createSessionToken(userAgent, ip, HMAC_SECRET, TOKEN_TTL_MS);
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  res.json({ token, expiresAt });
});
