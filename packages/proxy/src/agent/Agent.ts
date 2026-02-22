import { randomUUID } from 'node:crypto';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { createProviderFromEnv } from './llmProvider.js';
import { geocode } from '../tools/geocoding.js';
import { searchPOIs } from '../tools/poiSearch.js';
import { calculateRoute } from '../tools/routing.js';
import { webSearch } from '../tools/webSearch.js';
import type { AgentQueryRequest, AgentResponse, UIComponentPayload } from '@ai-interface/shared';

let _provider: ReturnType<typeof createProviderFromEnv> | null = null;
function getProvider() {
  if (!_provider) _provider = createProviderFromEnv();
  return _provider;
}

interface ChatMessage {
  role: string;
  content: any;
  tool_calls?: any[];
  tool_call_id?: string;
}

const sessionMemories = new Map<string, ChatMessage[]>();
const MAX_MEMORY = 6;

function getMemory(sessionId: string): ChatMessage[] {
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
    case 'web_search': {
      const results = await webSearch(input.query, input.category);
      return JSON.stringify(results);
    }
    case 'render_component':
    case 'show_notification':
    case 'remove_component':
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

  const messages: ChatMessage[] = [
    ...memory,
    { role: 'user', content: contextBlock },
  ];

  const components: UIComponentPayload[] = [];
  const removeComponents: string[] = [];
  const notifications: AgentResponse['notifications'] = [];
  let agentMessage = '';

  let continueLoop = true;
  while (continueLoop) {
    const response = await getProvider().chat(SYSTEM_PROMPT, messages, TOOL_DEFINITIONS, 8192);

    if (response.content) {
      agentMessage += response.content;
    }

    if (response.tool_calls.length > 0) {
      // Add assistant message with tool calls to context
      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      for (const toolCall of response.tool_calls) {
        let args: Record<string, any>;
        try {
          args = JSON.parse(toolCall.arguments);
        } catch {
          args = {};
        }

        const result = await executeTool(toolCall.name, args);

        // Extract UI actions
        if (toolCall.name === 'render_component') {
          const componentId = randomUUID().slice(0, 8);
          components.push({
            component_id: componentId,
            html: args.html.replace(/\{\{COMPONENT_ID\}\}/g, componentId),
            metadata: {
              component_type: args.component_type || 'unknown',
              sandbox_permissions: ['allow-scripts'],
              intent_schema: args.intent_schema || {},
            },
          });
        } else if (toolCall.name === 'show_notification') {
          notifications.push({ type: args.type, message: args.message });
        } else if (toolCall.name === 'remove_component') {
          removeComponents.push(args.component_id);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    } else {
      continueLoop = false;
    }

    if (response.finish_reason !== 'tool_calls') {
      continueLoop = false;
    }
  }

  // Update memory
  memory.push({ role: 'user', content: contextBlock });
  if (agentMessage) {
    memory.push({ role: 'assistant', content: agentMessage });
  }
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
