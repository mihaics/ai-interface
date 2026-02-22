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
import { readSessionFile, writeSessionFile, listSessionFiles } from '../tools/fileOps.js';
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
const MAX_MEMORY = 20;

function getMemory(sessionId: string): ChatMessage[] {
  if (!sessionMemories.has(sessionId)) {
    sessionMemories.set(sessionId, []);
  }
  return sessionMemories.get(sessionId)!;
}

interface SessionContext {
  uploadedFiles: string[];
  componentTypes: string[];
}

const sessionContexts = new Map<string, SessionContext>();

function getSessionContext(sessionId: string): SessionContext {
  if (!sessionContexts.has(sessionId)) {
    sessionContexts.set(sessionId, { uploadedFiles: [], componentTypes: [] });
  }
  return sessionContexts.get(sessionId)!;
}

async function executeTool(name: string, input: Record<string, any>, sessionId: string): Promise<string> {
  try {
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
        if (Array.isArray(results) && results.length === 0) {
          return JSON.stringify({ results: [], hint: 'No results found. Try broader search terms or a different category (general, news, science, images, files).' });
        }
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
      case 'list_session_files': {
        const files = await listSessionFiles(sessionId);
        return JSON.stringify(files);
      }
      case 'render_component':
      case 'show_notification':
      case 'remove_component':
      case 'update_component':
        return JSON.stringify({ status: 'queued', ...input });
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    const msg = err.message || 'Unknown error';
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      return JSON.stringify({ error: msg, hint: 'Network error. The URL may be invalid or the service is down.' });
    }
    if (msg.includes('403') || msg.includes('Forbidden')) {
      return JSON.stringify({ error: msg, hint: 'Access denied. The site blocks automated requests. Try a different source.' });
    }
    if (msg.includes('404') || msg.includes('Not Found')) {
      return JSON.stringify({ error: msg, hint: 'Page not found. The URL may be outdated. Try searching for the content instead.' });
    }
    if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('ETIMEDOUT')) {
      return JSON.stringify({ error: msg, hint: 'Request timed out. Try again or use a different source.' });
    }
    return JSON.stringify({ error: msg });
  }
}

export async function processQuery(request: AgentQueryRequest): Promise<AgentResponse> {
  const { query, context } = request;
  const memory = getMemory(context.session_id);
  const sessionCtx = getSessionContext(context.session_id);

  // Track uploaded files from context
  if (context.uploaded_files) {
    for (const f of context.uploaded_files) {
      if (!sessionCtx.uploadedFiles.includes(f)) sessionCtx.uploadedFiles.push(f);
    }
  }

  const contextBlock = `Session: ${context.session_id}
Active components: ${context.active_components.join(', ') || 'none'}
${sessionCtx.uploadedFiles.length > 0 ? `Uploaded files: ${sessionCtx.uploadedFiles.join(', ')}` : ''}
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
  const componentUpdates: Array<{ component_id: string; action: string; payload: Record<string, unknown> }> = [];
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

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
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

          return { toolCall, args, result };
        })
      );

      // Process results sequentially (UI extraction order matters)
      for (const { toolCall, args, result: rawResult } of toolResults) {
        let result = rawResult;

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
        } else if (toolCall.name === 'update_component') {
          componentUpdates.push({
            component_id: args.component_id,
            action: args.action,
            payload: args.payload || {},
          });
        } else if (toolCall.name === 'fetch_page') {
          const page = JSON.parse(result);
          if (page.content && page.mime_type !== 'error') {
            const componentId = randomUUID().slice(0, 8);
            const html = buildReaderViewHtml(page);
            components.push({
              component_id: componentId,
              html,
              metadata: {
                component_type: 'web_page',
                sandbox_permissions: ['allow-scripts'],
                intent_schema: {},
              },
            });
            result = JSON.stringify({
              title: page.title,
              excerpt: page.excerpt || page.text_content?.slice(0, 500) || '',
              byline: page.byline,
              length: page.length,
              component_id: componentId,
              note: 'Full article rendered in reader view window.',
            });
          }
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

  // Track component types in session context
  for (const c of components) {
    const type = c.metadata.component_type;
    if (!sessionCtx.componentTypes.includes(type)) sessionCtx.componentTypes.push(type);
  }

  return {
    message: agentMessage,
    components: components.length > 0 ? components : undefined,
    remove_components: removeComponents.length > 0 ? removeComponents : undefined,
    notifications: notifications.length > 0 ? notifications : undefined,
    component_updates: componentUpdates.length > 0 ? componentUpdates : undefined,
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
    const stderrFilter = /font cache|non-interactive|cannot be shown/i;
    pyodide.setStderr({ batched: (text) => {
      if (!stderrFilter.test(text)) out.textContent += text + '\\n';
    }});

    // Redirect matplotlib to inline SVG, suppress warnings
    await pyodide.runPythonAsync(\`
import sys, io, warnings
warnings.filterwarnings('ignore')
try:
    import matplotlib
    matplotlib.use('agg')
    import matplotlib.pyplot as plt
    plt.show = lambda *a, **k: None
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

function buildReaderViewHtml(page: { title: string; content: string; byline: string; excerpt: string }): string {
  const safeContent = page.content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');

  return `<div style="background:#1a1a2e;color:#d4d4d4;width:100vw;height:100vh;overflow:auto">
<article style="max-width:720px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;line-height:1.8;font-size:17px">
<header style="margin-bottom:32px;border-bottom:1px solid #333;padding-bottom:20px">
<h1 style="font-size:28px;color:#e0e0e0;margin:0 0 8px;line-height:1.3">${page.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h1>
${page.byline ? `<div style="color:#888;font-size:14px;font-style:italic">${page.byline.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
</header>
<div id="article-body" style="color:#ccc">${safeContent}</div>
</article>
<style>
  #article-body img { max-width:100%; height:auto; border-radius:4px; margin:16px 0; }
  #article-body a { color:#6b9fff; text-decoration:none; }
  #article-body a:hover { text-decoration:underline; }
  #article-body p { margin:0 0 16px; }
  #article-body h1,#article-body h2,#article-body h3 { color:#e0e0e0; margin:24px 0 12px; }
  #article-body blockquote { border-left:3px solid #444; padding-left:16px; color:#999; margin:16px 0; }
  #article-body pre,#article-body code { background:#111; padding:2px 6px; border-radius:3px; font-size:14px; }
  #article-body pre { padding:12px; overflow-x:auto; }
  #article-body ul,#article-body ol { margin:0 0 16px; padding-left:24px; }
  #article-body li { margin-bottom:6px; }
</style>
</div>`;
}
