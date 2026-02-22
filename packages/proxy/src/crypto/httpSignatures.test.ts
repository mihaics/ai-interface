import { describe, it, expect } from 'vitest';
import { signRequest, verifyRequest, computeContentDigest } from './httpSignatures.js';

const SECRET = 'test-signing-secret';

describe('HTTP Message Signatures', () => {
  it('signs and verifies a POST request', () => {
    const method = 'POST';
    const path = '/mcp';
    const contentType = 'application/json';
    const body = JSON.stringify({ query: 'find cafes' });
    const keyId = 'session-abc';

    const headers = signRequest({ method, path, contentType, body, keyId, secret: SECRET });
    expect(headers['signature-input']).toBeDefined();
    expect(headers['signature']).toBeDefined();
    expect(headers['content-digest']).toBeDefined();

    const valid = verifyRequest({
      method, path, contentType, body,
      signatureInput: headers['signature-input'],
      signature: headers['signature'],
      contentDigest: headers['content-digest'],
      secret: SECRET,
    });
    expect(valid).toBe(true);
  });

  it('rejects tampered body', () => {
    const headers = signRequest({
      method: 'POST', path: '/mcp', contentType: 'application/json',
      body: '{"query":"find cafes"}', keyId: 'abc', secret: SECRET,
    });

    const valid = verifyRequest({
      method: 'POST', path: '/mcp', contentType: 'application/json',
      body: '{"query":"find hotels"}',
      signatureInput: headers['signature-input'],
      signature: headers['signature'],
      contentDigest: headers['content-digest'],
      secret: SECRET,
    });
    expect(valid).toBe(false);
  });

  it('computes correct content digest', () => {
    const digest = computeContentDigest('hello');
    expect(digest).toMatch(/^sha-256=:/);
    expect(digest).toMatch(/:$/);
  });
});
