import { describe, it, expect } from 'vitest';
import { geocode, reverseGeocode } from './geocoding.js';

describe('geocoding', () => {
  it('exports geocode function', () => {
    expect(typeof geocode).toBe('function');
  });

  it('exports reverseGeocode function', () => {
    expect(typeof reverseGeocode).toBe('function');
  });
});
