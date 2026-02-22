import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

describe('agent setup', () => {
  it('has all required tool definitions', () => {
    const toolNames = TOOL_DEFINITIONS.map(t => t.function.name);
    expect(toolNames).toContain('geocode');
    expect(toolNames).toContain('search_pois');
    expect(toolNames).toContain('calculate_route');
    expect(toolNames).toContain('render_component');
    expect(toolNames).toContain('show_notification');
    expect(toolNames).toContain('remove_component');
  });

  it('system prompt instructs generative UI', () => {
    expect(SYSTEM_PROMPT).toContain('render_component');
    expect(SYSTEM_PROMPT).toContain('self-contained');
    expect(SYSTEM_PROMPT).toContain('Leaflet');
    expect(SYSTEM_PROMPT).toContain('postMessage');
    expect(SYSTEM_PROMPT).toContain('COMPONENT_ID');
  });

  it('render_component tool accepts html and intent_schema', () => {
    const renderTool = TOOL_DEFINITIONS.find(t => t.function.name === 'render_component');
    expect(renderTool).toBeDefined();
    const params = renderTool!.function.parameters as any;
    expect(params.properties.html).toBeDefined();
    expect(params.properties.intent_schema).toBeDefined();
  });
});
