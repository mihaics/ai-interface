import type { Request, Response, NextFunction } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();
const MAX_REQUESTS_PER_WINDOW = 60;
const WINDOW_MS = 60_000;

// Evict expired buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 300_000);

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const sessionId = (req as any).session?.sid || req.ip || 'unknown';
  const now = Date.now();

  let bucket = buckets.get(sessionId);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(sessionId, bucket);
  }

  bucket.count++;

  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'rate_limit_exceeded' });
    return;
  }

  next();
}
