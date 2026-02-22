import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

describe('agent setup', () => {
  it('has all required tool definitions', () => {
    const toolNames = TOOL_DEFINITIONS.map((t: any) => t.function.name);
    // GIS tools
    expect(toolNames).toContain('geocode');
    expect(toolNames).toContain('search_pois');
    expect(toolNames).toContain('calculate_route');
    // UI tools
    expect(toolNames).toContain('render_component');
    expect(toolNames).toContain('show_notification');
    expect(toolNames).toContain('remove_component');
    // Universal browser tools
    expect(toolNames).toContain('web_search');
    expect(toolNames).toContain('fetch_page');
    expect(toolNames).toContain('execute_code');
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('write_file');
    // Verify exact count
    expect(toolNames).toHaveLength(11);
  });

  it('system prompt covers universal capabilities', () => {
    expect(SYSTEM_PROMPT).toContain('web search');
    expect(SYSTEM_PROMPT).toContain('code execution');
    expect(SYSTEM_PROMPT).toContain('render_component');
    expect(SYSTEM_PROMPT).toContain('COMPONENT_ID');
    expect(SYSTEM_PROMPT).toContain('data_table');
    expect(SYSTEM_PROMPT).toContain('code_output');
  });

  it('render_component tool accepts html', () => {
    const renderTool = TOOL_DEFINITIONS.find((t: any) => t.function.name === 'render_component');
    expect(renderTool).toBeDefined();
    const params = (renderTool as any).function.parameters as any;
    expect(params.properties.html).toBeDefined();
    expect(params.properties.component_type).toBeDefined();
  });
});
