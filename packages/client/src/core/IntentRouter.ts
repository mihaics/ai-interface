import type { IntentMessage, IntentFieldSchema } from '@ai-interface/shared';
import type { SandboxRegistry, SandboxEntry } from './SandboxRegistry.js';

type IntentHandler = (componentId: string, intent: string, payload: Record<string, unknown>) => void;

const MAX_INTENTS_PER_SECOND = 10;

export class IntentRouter {
  private handlers: IntentHandler[] = [];

  constructor(private readonly registry: SandboxRegistry) {}

  onIntent(handler: IntentHandler): void {
    this.handlers.push(handler);
  }

  /** Attach to window message events. Call this once on app init. */
  attach(): () => void {
    const listener = (event: MessageEvent) => this.handleMessage(event);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }

  /** Process a single message event. Exported for testing. */
  handleMessage(event: MessageEvent): void {
    // Layer 1: Origin check — srcDoc iframes have origin 'null'
    if (event.origin !== 'null') return;

    // Layer 2: Source check — must be a registered sandbox
    const entry = this.registry.getBySource(event.source);
    if (!entry) return;

    // Parse the intent message
    const data = event.data as IntentMessage;
    if (data?.type !== 'ui_intent') return;
    if (!data.component_id || !data.intent) return;

    // Layer 3: Schema validation
    if (!this.validateSchema(data, entry)) return;

    // Layer 4: Rate limiting
    if (!this.checkRateLimit(entry)) return;

    // Forward to handlers
    for (const handler of this.handlers) {
      handler(data.component_id, data.intent, data.payload);
    }
  }

  private validateSchema(data: IntentMessage, entry: SandboxEntry): boolean {
    const schema = entry.intentSchema[data.intent];
    if (!schema) return false; // Unknown intent

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const value = data.payload[field];
      if (value === undefined) return false; // Missing required field
      if (!this.checkType(value, fieldSchema)) return false;
    }
    return true;
  }

  private checkType(value: unknown, schema: IntentFieldSchema): boolean {
    switch (schema.type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'object': return typeof value === 'object' && value !== null;
      case 'array': return Array.isArray(value);
      default: return false;
    }
  }

  private checkRateLimit(entry: SandboxEntry): boolean {
    const now = Date.now();
    if (now - entry.lastRequestTime > 1000) {
      entry.requestCount = 0;
    }
    entry.requestCount++;
    entry.lastRequestTime = now;
    return entry.requestCount <= MAX_INTENTS_PER_SECOND;
  }
}
