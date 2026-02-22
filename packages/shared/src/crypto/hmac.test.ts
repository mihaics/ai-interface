import { describe, it, expect } from 'vitest';
import { hmacSign, hmacVerify, base64url } from './hmac.js';

describe('hmac', () => {
  const secret = 'test-secret-key-1234567890';

  it('signs and verifies a payload', () => {
    const payload = 'hello world';
    const signature = hmacSign(payload, secret);
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
    expect(hmacVerify(payload, signature, secret)).toBe(true);
  });

  it('rejects tampered payload', () => {
    const payload = 'hello world';
    const signature = hmacSign(payload, secret);
    expect(hmacVerify('hello world!', signature, secret)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const payload = 'hello world';
    const signature = hmacSign(payload, secret);
    expect(hmacVerify(payload, signature, 'wrong-secret')).toBe(false);
  });
});

describe('base64url', () => {
  it('encodes and decodes round-trip', () => {
    const input = JSON.stringify({ sid: '123', iat: Date.now() });
    const encoded = base64url.encode(input);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(base64url.decode(encoded)).toBe(input);
  });
});
