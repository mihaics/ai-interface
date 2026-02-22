import { describe, it, expect } from 'vitest';
import { readSessionFile, writeSessionFile, getSessionDir } from './fileOps.js';

describe('fileOps', () => {
  it('exports read and write functions', () => {
    expect(typeof readSessionFile).toBe('function');
    expect(typeof writeSessionFile).toBe('function');
    expect(typeof getSessionDir).toBe('function');
  });
});
