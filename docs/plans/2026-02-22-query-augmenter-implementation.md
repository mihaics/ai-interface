# Query Augmenter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a small-model preprocessing layer that classifies, de-ambiguates, and routes user queries before they reach the main agent model.

**Architecture:** A new `queryAugmenter.ts` module creates a second LLM provider (same credentials, smaller model) that produces a structured JSON metadata envelope. Called at the top of `processQuery()` in `Agent.ts`. Trivial queries short-circuit; complex queries get metadata prepended to the big model's context. Graceful fallback on failure.

**Tech Stack:** TypeScript, OpenAI/Anthropic SDKs (existing), Vitest

---

### Task 1: Create augmenter provider factory in llmProvider.ts

**Files:**
- Modify: `packages/proxy/src/agent/llmProvider.ts:165-182`
- Test: `packages/proxy/src/agent/llmProvider.test.ts` (create)

**Step 1: Write the failing test**

Create `packages/proxy/src/agent/llmProvider.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx -w packages/proxy vitest run src/agent/llmProvider.test.ts`
Expected: FAIL with "createAugmenterProviderFromEnv is not a function" or similar import error

**Step 3: Write minimal implementation**

Add to `packages/proxy/src/agent/llmProvider.ts` at the end of the file (after `createProviderFromEnv`):

```typescript
/** Create augmenter provider from environment variables. Returns null if disabled. */
export function createAugmenterProviderFromEnv(): LLMProvider | null {
  const enabled = process.env.AUGMENTER_ENABLED !== 'false'; // default true
  if (!enabled) return null;

  const provider = process.env.LLM_PROVIDER || 'openai';
  const augmenterModel = process.env.AUGMENTER_MODEL;

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const model = augmenterModel || 'claude-haiku-4-5-20251001';
    console.log(`Augmenter provider: Anthropic (${model})`);
    return createAnthropicProvider(apiKey, model);
  }

  // openai-compatible
  const baseURL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1';
  const apiKey = process.env.LLM_API_KEY || 'ollama';
  const model = augmenterModel || 'gpt-4o-mini';
  console.log(`Augmenter provider: OpenAI-compatible at ${baseURL} (${model})`);
  return createOpenAIProvider(baseURL, apiKey, model);
}
```

**Step 4: Run test to verify it passes**

Run: `npx -w packages/proxy vitest run src/agent/llmProvider.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add packages/proxy/src/agent/llmProvider.ts packages/proxy/src/agent/llmProvider.test.ts
git commit --no-gpg-sign -m "feat: add augmenter provider factory"
```

---

### Task 2: Create queryAugmenter module with augmenter prompt and types

**Files:**
- Create: `packages/proxy/src/agent/queryAugmenter.ts`
- Test: `packages/proxy/src/agent/queryAugmenter.test.ts` (create)

**Step 1: Write the failing test**

Create `packages/proxy/src/agent/queryAugmenter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    const systemPrompt: string = chatCall[0];
    const messages: any[] = chatCall[1];

    // The user message should include session context
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
```

**Step 2: Run test to verify it fails**

Run: `npx -w packages/proxy vitest run src/agent/queryAugmenter.test.ts`
Expected: FAIL with "Cannot find module './queryAugmenter.js'"

**Step 3: Write minimal implementation**

Create `packages/proxy/src/agent/queryAugmenter.ts`:

```typescript
import type { LLMProvider } from './llmProvider.js';
import type { AgentContext } from '@ai-interface/shared';

export interface AugmentResult {
  route: 'direct' | 'agent';
  direct_response?: string;
  intent?: string;
  entities?: Record<string, string>;
  augmented_query?: string;
  suggested_tools?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
}

const AUGMENTER_PROMPT = `You are a query preprocessor for an AI assistant that creates visual experiences. Analyze the user's message and return JSON only.

If the query is trivial (greeting, thanks, simple math, identity question, meta-conversation like "help"), return:
{"route":"direct","direct_response":"<brief friendly response>"}

Otherwise, return:
{"route":"agent","intent":"<category>","entities":{...},"augmented_query":"<clearer version>","suggested_tools":["tool1","tool2"],"complexity":"simple|medium|complex"}

Intent categories: data_analysis, web_search, map_geo, interactive_app, code_execution, file_operation, general_knowledge, comparison

Available tools: web_search, fetch_page, execute_code, render_component, geocode, search_pois, calculate_route, read_file, write_file, list_session_files

Rules:
- augmented_query: clarify ambiguity and resolve pronouns from session context, but do NOT invent requirements the user didn't ask for
- suggested_tools: suggest likely tools — these are HINTS only
- entities: extract location names, file references, URLs, topics
- Return ONLY valid JSON. No markdown, no explanation.`;

function buildAugmenterInput(query: string, context: AgentContext): string {
  const parts = [`User query: ${query}`];
  if (context.active_components.length > 0) {
    parts.push(`Active components: ${context.active_components.join(', ')}`);
  }
  if (context.uploaded_files && context.uploaded_files.length > 0) {
    parts.push(`Uploaded files: ${context.uploaded_files.join(', ')}`);
  }
  if (context.last_user_intent) {
    parts.push(`Last intent: ${JSON.stringify(context.last_user_intent)}`);
  }
  return parts.join('\n');
}

function parseAugmenterResponse(raw: string | null, originalQuery: string): AugmentResult {
  if (!raw || !raw.trim()) {
    return { route: 'agent', augmented_query: originalQuery };
  }

  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.route === 'direct' && parsed.direct_response) {
      return { route: 'direct', direct_response: parsed.direct_response };
    }
    return {
      route: 'agent',
      intent: parsed.intent,
      entities: parsed.entities,
      augmented_query: parsed.augmented_query || originalQuery,
      suggested_tools: parsed.suggested_tools,
      complexity: parsed.complexity,
    };
  } catch {
    return { route: 'agent', augmented_query: originalQuery };
  }
}

export async function augmentQuery(
  query: string,
  context: AgentContext,
  provider: LLMProvider,
): Promise<AugmentResult> {
  try {
    const input = buildAugmenterInput(query, context);
    const response = await provider.chat(
      AUGMENTER_PROMPT,
      [{ role: 'user', content: input }],
      [], // no tools
      512,
    );
    return parseAugmenterResponse(response.content, query);
  } catch {
    // Fallback: skip augmentation entirely
    return { route: 'agent', augmented_query: query };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx -w packages/proxy vitest run src/agent/queryAugmenter.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add packages/proxy/src/agent/queryAugmenter.ts packages/proxy/src/agent/queryAugmenter.test.ts
git commit --no-gpg-sign -m "feat: add query augmenter module with prompt and types"
```

---

### Task 3: Integrate augmenter into Agent.ts processQuery

**Files:**
- Modify: `packages/proxy/src/agent/Agent.ts:1-4` (imports)
- Modify: `packages/proxy/src/agent/Agent.ts:14-18` (provider setup)
- Modify: `packages/proxy/src/agent/Agent.ts:121-145` (top of processQuery)

**Step 1: Write the failing test**

Add to `packages/proxy/src/agent/Agent.test.ts`:

```typescript
import { SYSTEM_PROMPT } from './systemPrompt.js';

it('system prompt mentions augmenter context', () => {
  expect(SYSTEM_PROMPT).toContain('Augmenter');
  expect(SYSTEM_PROMPT).toContain('HINTS');
});
```

**Step 2: Run test to verify it fails**

Run: `npx -w packages/proxy vitest run src/agent/Agent.test.ts`
Expected: FAIL — system prompt doesn't contain 'Augmenter' yet

**Step 3: Implement the integration**

3a. Add augmenter section to system prompt in `packages/proxy/src/agent/systemPrompt.ts`. Insert before the closing backtick (before `Reply with a brief plain-text summary.`):

```
## Augmenter Context
Your input may include an [Augmenter context] block with intent classification, entities, and suggested tools from a preprocessing step.
These are HINTS — use them to inform your approach but override them if your judgment differs.
The [Original query] after the block is always authoritative.
```

3b. In `packages/proxy/src/agent/Agent.ts`, add imports at the top:

```typescript
import { augmentQuery, type AugmentResult } from './queryAugmenter.js';
import { createAugmenterProviderFromEnv, type LLMProvider } from './llmProvider.js';
```

3c. Add augmenter provider singleton (below the existing `_provider` block around line 14):

```typescript
let _augmenterProvider: LLMProvider | null | undefined = undefined;
function getAugmenterProvider(): LLMProvider | null {
  if (_augmenterProvider === undefined) _augmenterProvider = createAugmenterProviderFromEnv();
  return _augmenterProvider;
}
```

3d. In `processQuery`, insert augmentation logic after the session context setup (after line 131 `for (const f of context.uploaded_files)` block) and before the `contextBlock` construction:

```typescript
  // Query augmentation
  let augment: AugmentResult | null = null;
  const augmenterProvider = getAugmenterProvider();
  if (augmenterProvider) {
    augment = await augmentQuery(query, context, augmenterProvider);
    if (augment.route === 'direct' && augment.direct_response) {
      memory.push({ role: 'user', content: query });
      memory.push({ role: 'assistant', content: augment.direct_response });
      return { message: augment.direct_response };
    }
  }
```

3e. Modify the `contextBlock` construction to include augmenter metadata when available. Replace the existing `contextBlock` template literal with:

```typescript
  // Build augmenter context prefix if available
  let augmenterPrefix = '';
  if (augment && augment.route === 'agent') {
    const parts: string[] = ['[Augmenter context]'];
    if (augment.intent) parts.push(`Intent: ${augment.intent}${augment.complexity ? ` | Complexity: ${augment.complexity}` : ''}`);
    if (augment.entities && Object.keys(augment.entities).length > 0) {
      parts.push(`Entities: ${Object.entries(augment.entities).map(([k, v]) => `${k}=${v}`).join('; ')}`);
    }
    if (augment.suggested_tools && augment.suggested_tools.length > 0) {
      parts.push(`Suggested tools: ${augment.suggested_tools.join(', ')}`);
    }
    if (augment.augmented_query && augment.augmented_query !== query) {
      parts.push(`Enhanced query: ${augment.augmented_query}`);
    }
    parts.push('');
    parts.push('[Original query]');
    augmenterPrefix = parts.join('\n') + '\n';
  }

  const contextBlock = `Session: ${context.session_id}
Active components: ${context.active_components.join(', ') || 'none'}
${sessionCtx.uploadedFiles.length > 0 ? `Uploaded files: ${sessionCtx.uploadedFiles.join(', ')}` : ''}
${sessionCtx.componentTypes.length > 0 ? `Previously rendered: ${sessionCtx.componentTypes.join(', ')}` : ''}
${context.viewport ? `Viewport: center=[${context.viewport.center}], zoom=${context.viewport.zoom}` : ''}
${context.last_user_intent ? `Last intent: ${JSON.stringify(context.last_user_intent)}` : ''}

${augmenterPrefix}User: ${query}`;
```

**Step 4: Run test to verify it passes**

Run: `npx -w packages/proxy vitest run src/agent/Agent.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/proxy/src/agent/Agent.ts packages/proxy/src/agent/systemPrompt.ts packages/proxy/src/agent/Agent.test.ts
git commit --no-gpg-sign -m "feat: integrate query augmenter into agent pipeline"
```

---

### Task 4: Update environment configuration

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Step 1: Add augmenter env vars to .env.example**

Add after the `CORS_ORIGIN` section at the end of `.env.example`:

```
# Query Augmenter (preprocesses queries with a smaller model)
# AUGMENTER_ENABLED=true
# AUGMENTER_MODEL=gpt-4o-mini
```

**Step 2: Add augmenter env vars to docker-compose.yml proxy service**

In the `proxy` service `environment` section, add:

```yaml
      - AUGMENTER_ENABLED=${AUGMENTER_ENABLED:-true}
      - AUGMENTER_MODEL=${AUGMENTER_MODEL:-}
```

**Step 3: Run all tests**

Run: `npx -w packages/proxy vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add .env.example docker-compose.yml
git commit --no-gpg-sign -m "feat: add augmenter env vars to config"
```

---

### Task 5: Run full test suite and verify Docker build

**Step 1: Run all proxy tests**

Run: `npx -w packages/proxy vitest run`
Expected: All tests PASS

**Step 2: Run TypeScript type check**

Run: `npx -w packages/proxy tsc --noEmit`
Expected: No errors

**Step 3: Verify Docker build**

Run: `docker compose build proxy` (from project root)
Expected: Build succeeds

**Step 4: Commit any fixes if needed, otherwise no commit needed**
