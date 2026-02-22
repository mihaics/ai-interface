import { randomUUID, createHash } from 'node:crypto';
import { hmacSign, hmacVerify, base64url } from '@ai-interface/shared';
import type { SessionTokenPayload } from '@ai-interface/shared';

function fingerprint(userAgent: string, ip: string): string {
  return createHash('sha256').update(userAgent + ip).digest('hex');
}

export function createSessionToken(
  userAgent: string,
  ip: string,
  secret: string,
  ttlMs: number = 7_200_000,
): string {
  const payload: SessionTokenPayload = {
    sid: randomUUID(),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    fpr: fingerprint(userAgent, ip),
  };
  const encoded = base64url.encode(JSON.stringify(payload));
  const signature = hmacSign(encoded, secret);
  return `${encoded}.${signature}`;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: SessionTokenPayload;
  error?: 'invalid_format' | 'invalid_signature' | 'token_expired' | 'fingerprint_mismatch';
}

export function validateSessionToken(
  token: string,
  userAgent: string,
  ip: string,
  secret: string,
): TokenValidationResult {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return { valid: false, error: 'invalid_format' };

  const encoded = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  if (!hmacVerify(encoded, signature, secret)) {
    return { valid: false, error: 'invalid_signature' };
  }

  const payload: SessionTokenPayload = JSON.parse(base64url.decode(encoded));

  if (Date.now() > payload.exp) {
    return { valid: false, error: 'token_expired' };
  }

  if (payload.fpr !== fingerprint(userAgent, ip)) {
    return { valid: false, error: 'fingerprint_mismatch' };
  }

  return { valid: true, payload };
}
