import { randomUUID } from 'node:crypto';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { createProviderFromEnv } from './llmProvider.js';
import { geocode } from '../tools/geocoding.js';
import { searchPOIs } from '../tools/poiSearch.js';
import { calculateRoute } from '../tools/routing.js';
import { webSearch } from '../tools/webSearch.js';
import { fetchPage } from '../tools/fetchPage.js';
import { prepareCodeExec } from '../tools/codeExec.js';
import { readSessionFile, writeSessionFile } from '../tools/fileOps.js';
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

async function executeTool(name: string, input: Record<string, any>, sessionId: string): Promise<string> {
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
    case 'fetch_page': {
      const content = await fetchPage(input.url);
      return JSON.stringify(content);
    }
    case 'execute_code': {
      const payload = prepareCodeExec(input.code, input.language);
      return JSON.stringify(payload);
    }
    case 'read_file': {
      const result = await readSessionFile(sessionId, input.filename);
      return JSON.stringify(result);
    }
    case 'write_file': {
      const result = await writeSessionFile(sessionId, input.filename, input.content);
      return JSON.stringify(result);
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

        let result: string;
        try {
          result = await executeTool(toolCall.name, args, context.session_id);
        } catch (err: any) {
          result = JSON.stringify({ error: err.message || 'Tool execution failed' });
        }

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
        } else if (toolCall.name === 'execute_code') {
          const payload = JSON.parse(result);
          const componentId = randomUUID().slice(0, 8);
          const html = buildCodeExecHtml(payload.code, payload.language);
          components.push({
            component_id: componentId,
            html,
            metadata: {
              component_type: 'code_output',
              sandbox_permissions: ['allow-scripts'],
              intent_schema: {},
            },
          });
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

function buildCodeExecHtml(code: string, language: string): string {
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  if (language === 'javascript') {
    return `<div style="background:#1a1a2e;color:#e0e0e0;font-family:monospace;padding:16px;width:100vw;height:100vh;overflow:auto">
<h3 style="color:#888;margin:0 0 8px">JavaScript</h3>
<pre style="background:#111;padding:12px;border-radius:4px;margin:0 0 8px;overflow-x:auto"><code>${escaped}</code></pre>
<h3 style="color:#888;margin:0 0 8px">Output</h3>
<pre id="output" style="background:#111;padding:12px;border-radius:4px;color:#4ade80;overflow-x:auto"></pre>
<script>
const _log = [];
const _origLog = console.log;
console.log = (...a) => { _log.push(a.map(String).join(' ')); _origLog(...a); };
try {
  const _result = eval(${JSON.stringify(code)});
  if (_result !== undefined) _log.push(String(_result));
} catch(e) {
  _log.push('Error: ' + e.message);
  parent.postMessage({ type: 'code_exec_error', component_id: COMPONENT_ID, error: e.message }, '*');
}
document.getElementById('output').textContent = _log.join('\\n');
</script></div>`;
  }

  // Python via Pyodide
  return `<div id="container" style="background:#1a1a2e;color:#e0e0e0;font-family:monospace;padding:16px;width:100vw;height:100vh;overflow:auto">
<details style="margin:0 0 8px">
<summary style="color:#888;cursor:pointer;font-size:14px">Python Source</summary>
<pre style="background:#111;padding:12px;border-radius:4px;margin:4px 0 0;overflow-x:auto"><code>${escaped}</code></pre>
</details>
<div id="output-label" style="color:#888;margin:0 0 8px;font-size:14px">Output</div>
<div id="output" style="background:#111;padding:12px;border-radius:4px;color:#4ade80;overflow-x:auto;white-space:pre-wrap">Loading Pyodide...</div>
<div id="visual" style="margin-top:12px"></div>
<script src="https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js"></script>
<script>
(async () => {
  const out = document.getElementById('output');
  const vis = document.getElementById('visual');
  try {
    out.textContent = 'Loading Pyodide...';
    const pyodide = await loadPyodide();
    out.textContent = 'Installing packages...';
    await pyodide.loadPackagesFromImports(${JSON.stringify(code)});
    out.textContent = '';
    pyodide.setStdout({ batched: (text) => { out.textContent += text + '\\n'; }});
    pyodide.setStderr({ batched: (text) => { out.textContent += text + '\\n'; }});

    // Redirect matplotlib to inline SVG
    await pyodide.runPythonAsync(\`
import sys, io
try:
    import matplotlib
    matplotlib.use('agg')
except ImportError:
    pass
\`);

    const result = await pyodide.runPythonAsync(${JSON.stringify(code)});

    // Check for matplotlib figures
    try {
      const svg = await pyodide.runPythonAsync(\`
try:
    import matplotlib.pyplot as plt
    figs = [plt.figure(i) for i in plt.get_fignums()]
    svgs = []
    for fig in figs:
        buf = io.BytesIO()
        fig.savefig(buf, format='svg', bbox_inches='tight', facecolor='#1a1a2e', edgecolor='none')
        buf.seek(0)
        svgs.append(buf.read().decode('utf-8'))
        plt.close(fig)
    '\\n'.join(svgs) if svgs else ''
except ImportError:
    ''
\`);
      if (svg) vis.innerHTML = svg;
    } catch(_) {}

    if (result !== undefined && result !== null && String(result).trim()) {
      if (!out.textContent.trim()) out.textContent = '';
      out.textContent += String(result);
    }
    if (!out.textContent.trim() && !vis.innerHTML.trim()) {
      out.textContent = '(no output)';
    }
  } catch(e) {
    out.textContent = 'Error: ' + e.message;
    parent.postMessage({ type: 'code_exec_error', component_id: COMPONENT_ID, error: e.message }, '*');
  }
})();
</script></div>`;
}
