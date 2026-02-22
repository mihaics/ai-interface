import type { IntentSchema, ComponentMetadata } from '@ai-interface/shared';

export interface SandboxEntry {
  componentId: string;
  iframe: HTMLIFrameElement;
  intentSchema: IntentSchema;
  metadata: ComponentMetadata;
  requestCount: number;
  lastRequestTime: number;
}

export class SandboxRegistry {
  private entries = new Map<string, SandboxEntry>();

  register(
    componentId: string,
    iframe: HTMLIFrameElement,
    metadata: ComponentMetadata,
  ): void {
    this.entries.set(componentId, {
      componentId,
      iframe,
      intentSchema: metadata.intent_schema,
      metadata,
      requestCount: 0,
      lastRequestTime: 0,
    });
  }

  unregister(componentId: string): void {
    this.entries.delete(componentId);
  }

  getByComponentId(componentId: string): SandboxEntry | undefined {
    return this.entries.get(componentId);
  }

  /** Find entry by iframe contentWindow reference (for postMessage source matching). */
  getBySource(source: MessageEventSource | null): SandboxEntry | undefined {
    if (!source) return undefined;
    for (const entry of this.entries.values()) {
      if (entry.iframe.contentWindow === source) return entry;
    }
    return undefined;
  }

  getActiveComponentIds(): string[] {
    return Array.from(this.entries.keys());
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
