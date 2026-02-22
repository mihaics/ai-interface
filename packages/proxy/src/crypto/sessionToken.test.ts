import { describe, it, expect } from 'vitest';
import { createSessionToken, validateSessionToken } from './sessionToken.js';

const SECRET = 'test-hmac-secret-64chars-long-abcdefghijklmnopqrstuvwxyz123456';

describe('session tokens', () => {
  it('creates a valid token and validates it', () => {
    const token = createSessionToken('test-user-agent', '127.0.0.1', SECRET, 3600_000);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const result = validateSessionToken(token, 'test-user-agent', '127.0.0.1', SECRET);
    expect(result.valid).toBe(true);
    expect(result.payload?.sid).toBeDefined();
  });

  it('rejects expired tokens', () => {
    const token = createSessionToken('ua', '127.0.0.1', SECRET, -1000);
    const result = validateSessionToken(token, 'ua', '127.0.0.1', SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('token_expired');
  });

  it('rejects tampered tokens', () => {
    const token = createSessionToken('ua', '127.0.0.1', SECRET, 3600_000);
    const tampered = token.slice(0, -5) + 'xxxxx';
    const result = validateSessionToken(tampered, 'ua', '127.0.0.1', SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('rejects mismatched fingerprint', () => {
    const token = createSessionToken('ua', '127.0.0.1', SECRET, 3600_000);
    const result = validateSessionToken(token, 'different-ua', '127.0.0.1', SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('fingerprint_mismatch');
  });
});
