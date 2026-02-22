/** Schema for a single intent field. */
export interface IntentFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

/** Maps intent names to their payload schemas. */
export type IntentSchema = Record<string, Record<string, IntentFieldSchema>>;

/** Message sent from sandboxed iframe to host via postMessage. */
export interface IntentMessage {
  type: 'ui_intent';
  component_id: string;
  intent: string;
  payload: Record<string, unknown>;
  timestamp: number;
  signature: string;
}

/** Message sent from host to sandboxed iframe via postMessage. */
export interface UpdateMessage {
  type: 'ui_update';
  component_id: string;
  action: string;
  payload: Record<string, unknown>;
  signature: string;
}
