import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Create HMAC-SHA256 signature of a payload.
 * Works in Node.js. For browser use, see WebCrypto wrapper in client package.
 */
export function hmacSign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison.
 */
export function hmacVerify(payload: string, signature: string, secret: string): boolean {
  const expected = hmacSign(payload, secret);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Base64url encode/decode utilities. */
export const base64url = {
  encode(input: string): string {
    return Buffer.from(input).toString('base64url');
  },
  decode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf-8');
  },
};
