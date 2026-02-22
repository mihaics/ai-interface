import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

describe('agent setup', () => {
  it('has all required tool definitions', () => {
    const toolNames = TOOL_DEFINITIONS.map((t: any) => t.function.name);
    expect(toolNames).toContain('geocode');
    expect(toolNames).toContain('search_pois');
    expect(toolNames).toContain('calculate_route');
    expect(toolNames).toContain('render_component');
    expect(toolNames).toContain('show_notification');
    expect(toolNames).toContain('remove_component');
    expect(toolNames).toContain('web_search');
    expect(toolNames).toContain('fetch_page');
    expect(toolNames).toContain('execute_code');
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('write_file');
    expect(toolNames).toContain('list_session_files');
    expect(toolNames).toContain('update_component');
    expect(toolNames).toHaveLength(13);
  });

  it('system prompt covers design system and decision trees', () => {
    expect(SYSTEM_PROMPT).toContain('--bg-base');
    expect(SYSTEM_PROMPT).toContain('--accent');
    expect(SYSTEM_PROMPT).toContain('render_component');
    expect(SYSTEM_PROMPT).toContain('COMPONENT_ID');
    expect(SYSTEM_PROMPT).toContain('execute_code');
    expect(SYSTEM_PROMPT).toContain('fetch_page');
    expect(SYSTEM_PROMPT).toContain('Decision Tree');
  });

  it('system prompt mentions augmenter context', () => {
    expect(SYSTEM_PROMPT).toContain('Augmenter');
    expect(SYSTEM_PROMPT).toContain('HINTS');
  });

  it('render_component tool accepts html', () => {
    const renderTool = TOOL_DEFINITIONS.find((t: any) => t.function.name === 'render_component');
    expect(renderTool).toBeDefined();
    const params = (renderTool as any).function.parameters as any;
    expect(params.properties.html).toBeDefined();
    expect(params.properties.component_type).toBeDefined();
  });
});
