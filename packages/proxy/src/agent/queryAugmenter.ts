import type { LLMProvider } from './llmProvider.js';
import type { AgentContext } from '@ai-interface/shared';

/** Result from the query augmenter. */
export interface AugmentResult {
  route: 'direct' | 'agent';
  direct_response?: string;
  intent?: string;
  entities?: Record<string, string>;
  augmented_query?: string;
  suggested_tools?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
}

/** System prompt for the small augmenter model. */
export const AUGMENTER_PROMPT = `You are a query classifier and augmenter for an AI assistant with a generative UI.
Your job: analyze the user's query and return a JSON routing decision.

## Route: direct
For trivial queries (greetings, thanks, simple math, identity questions, meta-conversation), return:
{"route":"direct","direct_response":"<your short response>"}

## Route: agent
For everything else, return:
{"route":"agent","intent":"<category>","entities":{<key-value pairs>},"augmented_query":"<enriched query>","suggested_tools":[<tool names>],"complexity":"<level>"}

Intent categories: data_analysis, web_search, map_geo, interactive_app, code_execution, file_operation, general_knowledge, comparison

Available tools: web_search, fetch_page, execute_code, render_component, geocode, search_pois, calculate_route, read_file, write_file, list_session_files

Complexity levels: simple, medium, complex

## Rules
- Clarify ambiguity but do not invent requirements the user did not state.
- Return ONLY valid JSON. No markdown, no explanation, no extra text.`;

/** Build the user message for the augmenter, including session context. */
export function buildAugmenterInput(
  query: string,
  context: AgentContext,
): { role: string; content: string }[] {
  const parts: string[] = [`Query: ${query}`];

  if (context.active_components.length > 0) {
    parts.push(`Active components: ${context.active_components.join(', ')}`);
  }

  if (context.uploaded_files && context.uploaded_files.length > 0) {
    parts.push(`Uploaded files: ${context.uploaded_files.join(', ')}`);
  }

  if (context.last_user_intent) {
    parts.push(`Last user intent: ${JSON.stringify(context.last_user_intent)}`);
  }

  return [{ role: 'user', content: parts.join('\n') }];
}

/** Parse the augmenter model's raw response into a typed AugmentResult. */
export function parseAugmenterResponse(
  raw: string | null | undefined,
  originalQuery: string,
): AugmentResult {
  const fallback: AugmentResult = { route: 'agent', augmented_query: originalQuery };

  if (!raw || raw.trim() === '') return fallback;

  // Strip markdown fences if present
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return fallback;
  }

  if (!parsed || typeof parsed !== 'object') return fallback;

  if (parsed.route === 'direct') {
    return {
      route: 'direct',
      direct_response: parsed.direct_response,
    };
  }

  if (parsed.route === 'agent') {
    return {
      route: 'agent',
      intent: parsed.intent,
      entities: parsed.entities,
      augmented_query: parsed.augmented_query || originalQuery,
      suggested_tools: parsed.suggested_tools,
      complexity: parsed.complexity,
    };
  }

  return fallback;
}

/** Augment a user query using a small/fast LLM provider. */
export async function augmentQuery(
  query: string,
  context: AgentContext,
  provider: LLMProvider,
): Promise<AugmentResult> {
  const fallback: AugmentResult = { route: 'agent', augmented_query: query };

  try {
    const messages = buildAugmenterInput(query, context);
    const response = await provider.chat(AUGMENTER_PROMPT, messages, [], 512);
    return parseAugmenterResponse(response.content, query);
  } catch (err) {
    console.warn('Augmenter failed, using fallback:', err instanceof Error ? err.message : err);
    return fallback;
  }
}
