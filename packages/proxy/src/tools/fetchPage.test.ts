import { describe, it, expect } from 'vitest';
import { fetchPage } from './fetchPage.js';

describe('fetchPage', () => {
  it('exports a fetchPage function', () => {
    expect(typeof fetchPage).toBe('function');
  });
});
