import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { geocode } from '../tools/geocoding.js';
import { searchPOIs } from '../tools/poiSearch.js';
import { calculateRoute } from '../tools/routing.js';
import type { AgentQueryRequest, AgentResponse, UIComponentPayload } from '@ai-interface/shared';

const client = new Anthropic();

interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
}

const sessionMemories = new Map<string, ConversationEntry[]>();
const MAX_MEMORY = 20;

function getMemory(sessionId: string): ConversationEntry[] {
  if (!sessionMemories.has(sessionId)) {
    sessionMemories.set(sessionId, []);
  }
  return sessionMemories.get(sessionId)!;
}

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  switch (name) {
    case 'geocode': {
      const results = await geocode(input.query);
      return JSON.stringify(results);
    }
    case 'search_pois': {
      const results = await searchPOIs(input.poi_type, input.lat, input.lon, input.radius);
      return JSON.stringify(results);
    }
    case 'calculate_route': {
      const result = await calculateRoute(
        input.from_lat, input.from_lon, input.to_lat, input.to_lon, input.mode,
      );
      return JSON.stringify(result);
    }
    case 'render_component':
    case 'show_notification':
    case 'remove_component':
      // UI tools — return the input as-is; the caller extracts them from tool_use blocks
      return JSON.stringify({ status: 'queued', ...input });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function processQuery(request: AgentQueryRequest): Promise<AgentResponse> {
  const { query, context } = request;
  const memory = getMemory(context.session_id);

  const contextBlock = `Session: ${context.session_id}
Active components: ${context.active_components.join(', ') || 'none'}
${context.viewport ? `Viewport: center=[${context.viewport.center}], zoom=${context.viewport.zoom}` : ''}
${context.last_user_intent ? `Last intent: ${JSON.stringify(context.last_user_intent)}` : ''}

User: ${query}`;

  // Build messages from memory
  const messages: Anthropic.MessageParam[] = [
    ...memory.map(e => ({ role: e.role as 'user' | 'assistant', content: e.content as any })),
    { role: 'user', content: contextBlock },
  ];

  const components: UIComponentPayload[] = [];
  const removeComponents: string[] = [];
  const notifications: AgentResponse['notifications'] = [];
  let agentMessage = '';

  // Agentic loop: keep calling until no more tool_use
  let continueLoop = true;
  while (continueLoop) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // Process content blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        agentMessage += block.text;
      } else if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input as Record<string, any>);

        // Extract UI actions from tool calls
        if (block.name === 'render_component') {
          const input = block.input as any;
          const componentId = randomUUID().slice(0, 8);
          components.push({
            component_id: componentId,
            html: input.html.replace(/\{\{COMPONENT_ID\}\}/g, componentId),
            metadata: {
              component_type: input.component_type || 'unknown',
              sandbox_permissions: ['allow-scripts'],
              intent_schema: input.intent_schema || {},
            },
          });
        } else if (block.name === 'show_notification') {
          const input = block.input as any;
          notifications.push({ type: input.type, message: input.message });
        } else if (block.name === 'remove_component') {
          removeComponents.push((block.input as any).component_id);
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }

    if (response.stop_reason === 'tool_use' && toolResults.length > 0) {
      // Add assistant response and tool results, continue loop
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    } else {
      continueLoop = false;
    }
  }

  // Update memory (keep last N entries)
  memory.push({ role: 'user', content: contextBlock });
  memory.push({ role: 'assistant', content: agentMessage });
  if (memory.length > MAX_MEMORY) {
    memory.splice(0, memory.length - MAX_MEMORY);
  }

  return {
    message: agentMessage,
    components: components.length > 0 ? components : undefined,
    remove_components: removeComponents.length > 0 ? removeComponents : undefined,
    notifications: notifications.length > 0 ? notifications : undefined,
  };
}
