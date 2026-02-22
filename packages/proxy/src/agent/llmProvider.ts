import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/** Unified tool call returned by either provider. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** Unified LLM response. */
export interface LLMResponse {
  content: string | null;
  tool_calls: ToolCall[];
  finish_reason: string;
}

/** Common interface for LLM providers. */
export interface LLMProvider {
  chat(
    systemPrompt: string,
    messages: any[],
    tools: OpenAI.ChatCompletionTool[],
    maxTokens: number,
  ): Promise<LLMResponse>;
}

/** OpenAI-compatible provider (works with Ollama, OpenAI, etc.) */
export function createOpenAIProvider(baseURL: string, apiKey: string, model: string): LLMProvider {
  const client = new OpenAI({ baseURL, apiKey });

  return {
    async chat(systemPrompt, messages, tools, maxTokens) {
      const allMessages = [{ role: 'system' as const, content: systemPrompt }, ...messages];

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await client.chat.completions.create({
            model,
            max_completion_tokens: maxTokens,
            messages: allMessages,
            tools,
            tool_choice: 'auto',
          });
          const choice = response.choices[0];
          if (!choice) return { content: null, tool_calls: [], finish_reason: 'stop' };

          return {
            content: choice.message.content,
            tool_calls: (choice.message.tool_calls || []).map((tc: any) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })),
            finish_reason: choice.finish_reason || 'stop',
          };
        } catch (err: any) {
          // Groq returns 400 when model generates malformed tool calls — retry once
          if (attempt === 0 && err?.status === 400) {
            console.warn('Tool call generation failed, retrying...');
            continue;
          }
          throw err;
        }
      }
      return { content: null, tool_calls: [], finish_reason: 'stop' };
    },
  };
}

/** Anthropic provider (Claude). */
export function createAnthropicProvider(apiKey: string, model: string): LLMProvider {
  const client = new Anthropic({ apiKey });

  return {
    async chat(systemPrompt, messages, tools, maxTokens) {
      // Convert OpenAI tool format → Anthropic tool format
      const anthropicTools = tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description || '',
        input_schema: t.function.parameters as any,
      }));

      // Convert OpenAI message format → Anthropic message format
      const anthropicMessages = convertMessages(messages);

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: anthropicTools,
        messages: anthropicMessages,
      });

      let content = '';
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: JSON.stringify(block.input),
          });
        }
      }

      return {
        content: content || null,
        tool_calls: toolCalls,
        finish_reason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      };
    },
  };
}

/** Convert OpenAI-style messages to Anthropic format. */
function convertMessages(messages: any[]): any[] {
  const result: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      const last = result[result.length - 1];
      const toolResult = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: msg.content,
      };
      if (last?.role === 'user' && Array.isArray(last.content)) {
        last.content.push(toolResult);
      } else {
        result.push({ role: 'user', content: [toolResult] });
      }
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls) {
      const content: any[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function?.name || tc.name,
          input: typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : (tc.arguments ? JSON.parse(tc.arguments) : {}),
        });
      }
      result.push({ role: 'assistant', content });
      continue;
    }

    result.push({ role: msg.role, content: msg.content });
  }

  return result;
}

/** Create provider from environment variables. */
export function createProviderFromEnv(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'openai';

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY required when LLM_PROVIDER=anthropic');
    const model = process.env.LLM_MODEL || 'claude-sonnet-4-20250514';
    console.log(`LLM provider: Anthropic (${model})`);
    return createAnthropicProvider(apiKey, model);
  }

  // openai-compatible (Ollama, OpenAI, etc.)
  const baseURL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1';
  const apiKey = process.env.LLM_API_KEY || 'ollama';
  const model = process.env.LLM_MODEL || 'qwen2.5:14b';
  console.log(`LLM provider: OpenAI-compatible at ${baseURL} (${model})`);
  return createOpenAIProvider(baseURL, apiKey, model);
}

/** Create augmenter provider from environment variables. Returns null if disabled or unconfigured. */
export function createAugmenterProviderFromEnv(): LLMProvider | null {
  if (process.env.AUGMENTER_ENABLED === 'false') return null;

  const provider = process.env.LLM_PROVIDER || 'openai';

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    const model = process.env.AUGMENTER_MODEL || 'claude-haiku-4-5-20251001';
    console.log(`Augmenter provider: Anthropic (${model})`);
    return createAnthropicProvider(apiKey, model);
  }

  // openai-compatible
  const baseURL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1';
  const apiKey = process.env.LLM_API_KEY || 'ollama';
  const model = process.env.AUGMENTER_MODEL || 'gpt-4o-mini';
  console.log(`Augmenter provider: OpenAI-compatible at ${baseURL} (${model})`);
  return createOpenAIProvider(baseURL, apiKey, model);
}
