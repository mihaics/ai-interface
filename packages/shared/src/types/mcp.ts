import type { IntentSchema } from './intent.js';

/** Metadata for an agent-generated UI component. */
export interface ComponentMetadata {
  component_type: string;
  sandbox_permissions: string[];
  intent_schema: IntentSchema;
}

/** Agent query request (client to proxy). */
export interface AgentQueryRequest {
  query: string;
  context: AgentContext;
}

/** Context sent with each agent query. */
export interface AgentContext {
  session_id: string;
  active_components: string[];
  viewport?: { center: [number, number]; zoom: number; bounds?: object };
  conversation_summary?: string;
  last_user_intent?: { type: string; payload: Record<string, unknown> };
  uploaded_files?: string[];
}

/** A UI component payload from the agent. */
export interface UIComponentPayload {
  component_id: string;
  html: string;
  metadata: ComponentMetadata;
}

/** Agent response (proxy to client). */
export interface AgentResponse {
  message: string;
  components?: UIComponentPayload[];
  remove_components?: string[];
  notifications?: Array<{ type: 'info' | 'success' | 'warning' | 'error'; message: string }>;
  component_updates?: Array<{ component_id: string; action: string; payload: Record<string, unknown> }>;
}
