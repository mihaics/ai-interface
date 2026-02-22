import { describe, it, expect, vi } from 'vitest';
import { augmentQuery, type AugmentResult } from './queryAugmenter.js';
import type { LLMProvider } from './llmProvider.js';
import type { AgentContext } from '@ai-interface/shared';

function mockContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    session_id: 'test-session',
    active_components: [],
    ...overrides,
  };
}

function mockProvider(response: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue({
      content: response,
      tool_calls: [],
      finish_reason: 'stop',
    }),
  };
}

describe('augmentQuery', () => {
  it('returns agent route with metadata for complex queries', async () => {
    const provider = mockProvider(JSON.stringify({
      route: 'agent',
      intent: 'web_search',
      entities: { location: 'Paris, France', topic: 'weather' },
      augmented_query: 'Show current weather conditions for Paris, France',
      suggested_tools: ['web_search', 'render_component'],
      complexity: 'medium',
    }));

    const result = await augmentQuery('weather paris', mockContext(), provider);
    expect(result.route).toBe('agent');
    expect(result.intent).toBe('web_search');
    expect(result.entities?.location).toBe('Paris, France');
    expect(result.augmented_query).toContain('Paris');
    expect(result.suggested_tools).toContain('web_search');
  });

  it('returns direct route for trivial queries', async () => {
    const provider = mockProvider(JSON.stringify({
      route: 'direct',
      direct_response: 'Hello! How can I help you today?',
    }));

    const result = await augmentQuery('hello', mockContext(), provider);
    expect(result.route).toBe('direct');
    expect(result.direct_response).toContain('Hello');
  });

  it('returns fallback on malformed JSON', async () => {
    const provider = mockProvider('this is not json at all');

    const result = await augmentQuery('weather paris', mockContext(), provider);
    expect(result.route).toBe('agent');
    expect(result.augmented_query).toBe('weather paris');
    expect(result.intent).toBeUndefined();
  });

  it('returns fallback when provider throws', async () => {
    const provider: LLMProvider = {
      chat: vi.fn().mockRejectedValue(new Error('network error')),
    };

    const result = await augmentQuery('weather paris', mockContext(), provider);
    expect(result.route).toBe('agent');
    expect(result.augmented_query).toBe('weather paris');
  });

  it('returns fallback on empty response', async () => {
    const provider = mockProvider('');

    const result = await augmentQuery('test query', mockContext(), provider);
    expect(result.route).toBe('agent');
    expect(result.augmented_query).toBe('test query');
  });

  it('passes session context to the provider', async () => {
    const provider = mockProvider(JSON.stringify({
      route: 'agent',
      intent: 'general_knowledge',
      augmented_query: 'test',
    }));

    const ctx = mockContext({
      active_components: ['comp-1', 'comp-2'],
      uploaded_files: ['data.csv'],
    });

    await augmentQuery('analyze this', ctx, provider);

    const chatCall = (provider.chat as any).mock.calls[0];
    const messages: any[] = chatCall[1];
    const userMsg = messages[0].content;
    expect(userMsg).toContain('analyze this');
    expect(userMsg).toContain('data.csv');
  });

  it('strips markdown fences from JSON response', async () => {
    const provider = mockProvider('```json\n{"route":"agent","intent":"web_search","augmented_query":"test query"}\n```');

    const result = await augmentQuery('test query', mockContext(), provider);
    expect(result.route).toBe('agent');
    expect(result.intent).toBe('web_search');
  });
});
