import { describe, it, expect } from 'vitest';
import { SessionManager } from './SessionManager.js';

describe('SessionManager', () => {
  it('starts with no token', () => {
    const sm = new SessionManager('http://localhost:3001');
    expect(sm.getToken()).toBeNull();
    expect(sm.isAuthenticated()).toBe(false);
  });
});
