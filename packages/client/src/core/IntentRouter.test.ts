import { describe, it, expect } from 'vitest';
import { IntentRouter } from './IntentRouter.js';
import { SandboxRegistry } from './SandboxRegistry.js';

describe('IntentRouter', () => {
  it('rejects messages from unknown sources', () => {
    const registry = new SandboxRegistry();
    const router = new IntentRouter(registry);
    const handled: any[] = [];
    router.onIntent((componentId, intent, payload) => handled.push({ componentId, intent, payload }));

    // Simulate a message with no matching source
    const event = new MessageEvent('message', {
      origin: 'null',
      data: { type: 'ui_intent', component_id: 'unknown', intent: 'click', payload: {}, timestamp: Date.now(), signature: '' },
    });
    router.handleMessage(event);

    expect(handled).toHaveLength(0);
  });
});
