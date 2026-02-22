import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAugmenterProviderFromEnv } from './llmProvider.js';

describe('createAugmenterProviderFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when AUGMENTER_ENABLED is false', () => {
    process.env.AUGMENTER_ENABLED = 'false';
    expect(createAugmenterProviderFromEnv()).toBeNull();
  });

  it('uses gpt-4o-mini as default for openai provider', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    process.env.LLM_API_KEY = 'test-key';
    process.env.AUGMENTER_ENABLED = 'true';
    const provider = createAugmenterProviderFromEnv();
    expect(provider).not.toBeNull();
  });

  it('uses claude-haiku as default for anthropic provider', () => {
    process.env.LLM_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.AUGMENTER_ENABLED = 'true';
    const provider = createAugmenterProviderFromEnv();
    expect(provider).not.toBeNull();
  });

  it('respects AUGMENTER_MODEL override', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    process.env.LLM_API_KEY = 'test-key';
    process.env.AUGMENTER_MODEL = 'custom-small-model';
    const provider = createAugmenterProviderFromEnv();
    expect(provider).not.toBeNull();
  });

  it('defaults to enabled when AUGMENTER_ENABLED is not set', () => {
    process.env.LLM_PROVIDER = 'openai';
    process.env.LLM_BASE_URL = 'https://api.openai.com/v1';
    process.env.LLM_API_KEY = 'test-key';
    const provider = createAugmenterProviderFromEnv();
    expect(provider).not.toBeNull();
  });
});
