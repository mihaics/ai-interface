import { describe, it, expect } from 'vitest';
import { webSearch } from './webSearch.js';

describe('webSearch', () => {
  it('exports a webSearch function', () => {
    expect(typeof webSearch).toBe('function');
  });
});
