import { describe, it, expect } from 'vitest';
import { prepareCodeExec } from './codeExec.js';

describe('codeExec', () => {
  it('returns code payload for browser execution', () => {
    const result = prepareCodeExec('print("hello")', 'python');
    expect(result.runtime).toBe('browser');
    expect(result.code).toBe('print("hello")');
    expect(result.language).toBe('python');
  });

  it('returns code payload for javascript', () => {
    const result = prepareCodeExec('console.log(1+1)', 'javascript');
    expect(result.language).toBe('javascript');
  });
});
