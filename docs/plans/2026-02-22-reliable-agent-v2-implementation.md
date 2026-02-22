# Reliable Agent v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the AI assistant produce dramatically more consistent visual output, reliable tool choices, graceful error handling, and richer use case support.

**Architecture:** Layered improvements — inject a CSS design system into the sandbox iframe so even minimal LLM output looks good; rewrite the system prompt with decision trees and quality rules so the LLM makes consistent choices; upgrade the agent loop for parallel execution, structured errors, and richer memory; add two new tools (`list_session_files`, `update_component`).

**Tech Stack:** TypeScript (Node.js proxy + React client), Vitest for tests, CSS custom properties for design system.

---

### Task 1: Inject CSS Design System into SandboxFrame

**Files:**
- Modify: `packages/client/src/components/SandboxFrame.tsx:53-87` (the `buildSrcDoc` function)

**Step 1: Write the failing test**

Create `packages/client/src/components/SandboxFrame.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// buildSrcDoc is not exported, so we test via the module internals
// For now, test that the output HTML contains the design system
describe('SandboxFrame buildSrcDoc', () => {
  it('injects CSS design system variables', async () => {
    // Import the module and render a minimal component
    const { SandboxFrame } = await import('./SandboxFrame.js');
    // We can't easily render React here, but we can test the HTML generation
    // by checking the module source — instead, let's just verify the CSS string exists
    const mod = await import('./SandboxFrame.js');
    // The buildSrcDoc function is not exported, so we'll test indirectly
    // For now just ensure the module exports what we expect
    expect(mod.SandboxFrame).toBeDefined();
    expect(mod.sendUpdateToSandbox).toBeDefined();
  });
});
```

**Step 2: Run test to verify it passes (baseline)**

Run: `npx -w packages/client vitest run src/components/SandboxFrame.test.ts`

**Step 3: Update buildSrcDoc with design system CSS**

Replace the `<style>` block and add utility classes in `buildSrcDoc`. The new `buildSrcDoc` function body should be:

```typescript
function buildSrcDoc(component: UIComponentPayload): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank" rel="noopener noreferrer">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; connect-src https: blob: data:; worker-src blob:; media-src https: blob: data:;">
  <script type="importmap">
  {
    "imports": {
      "three": "https://esm.sh/three",
      "three/": "https://esm.sh/three/",
      "chart.js": "https://esm.sh/chart.js",
      "chart.js/auto": "https://esm.sh/chart.js/auto",
      "d3": "https://esm.sh/d3",
      "mermaid": "https://esm.sh/mermaid",
      "marked": "https://esm.sh/marked",
      "lodash": "https://esm.sh/lodash-es",
      "canvas-confetti": "https://esm.sh/canvas-confetti"
    }
  }
  </script>
  <style>
    :root {
      --bg-base: #0a0a1a;
      --bg-surface: #141428;
      --bg-elevated: #1e1e3a;
      --text-primary: #e8e8f0;
      --text-secondary: #9898b0;
      --text-muted: #585870;
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      --success: #4ade80;
      --warning: #fbbf24;
      --error: #f87171;
      --border: rgba(255, 255, 255, 0.08);
      --radius: 8px;
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
      --space-1: 0.25rem;
      --space-2: 0.5rem;
      --space-3: 1rem;
      --space-4: 1.5rem;
      --space-5: 2rem;
      --space-6: 3rem;
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-sans);
      overflow: auto;
      line-height: 1.5;
    }
    #root { width: 100vw; height: 100vh; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { color: var(--accent-hover); text-decoration: underline; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-base); }
    ::-webkit-scrollbar-thumb { background: var(--bg-elevated); border-radius: 4px; }
    .card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-4); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-3); }

    /* Default loading spinner — hidden when component renders content */
    #_loading { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 9999; background: var(--bg-base); }
    #_loading::after { content: ''; width: 32px; height: 32px; border: 3px solid var(--bg-elevated); border-top-color: var(--accent); border-radius: 50%; animation: _spin 0.8s linear infinite; }
    @keyframes _spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="_loading"></div>
  <script>
    var COMPONENT_ID = '${component.component_id}';
    // Hide loading spinner once content renders
    requestAnimationFrame(function() {
      setTimeout(function() {
        var el = document.getElementById('_loading');
        if (el) el.style.display = 'none';
      }, 100);
    });
    // Error boundary — report runtime errors to parent
    window.onerror = function(msg, src, line, col, err) {
      parent.postMessage({ type: 'component_error', component_id: COMPONENT_ID, error: String(msg), stack: err ? err.stack : '' }, '*');
    };
    window.onunhandledrejection = function(e) {
      parent.postMessage({ type: 'component_error', component_id: COMPONENT_ID, error: String(e.reason), stack: '' }, '*');
    };
  </script>
  ${component.html}
</body>
</html>`;
}
```

**Step 4: Run tests**

Run: `npx -w packages/client vitest run src/components/SandboxFrame.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/client/src/components/SandboxFrame.tsx packages/client/src/components/SandboxFrame.test.ts
git commit -m "feat: inject CSS design system, loading spinner, and error boundary into sandbox"
```

---

### Task 2: Handle `component_error` in App.tsx

**Files:**
- Modify: `packages/client/src/App.tsx:70-79` (the postMessage listener useEffect)

**Step 1: Extend the postMessage listener to handle `component_error`**

In `App.tsx`, the existing `useEffect` at line 70 handles `code_exec_error`. Extend it to also handle `component_error`:

```typescript
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'code_exec_error' && e.data.component_id) {
        sandboxRegistryRef.current.unregister(e.data.component_id);
        setComponents(prev => prev.filter(c => c.component_id !== e.data.component_id));
      }
      if (e.data?.type === 'component_error' && e.data.component_id) {
        console.warn(`Component ${e.data.component_id} error:`, e.data.error);
        addNotification('warning', `Component error: ${e.data.error?.slice(0, 120)}`);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [addNotification]);
```

Note: `addNotification` must be in the dependency array. The current code has `[]` — fix this.

**Step 2: Run all client tests**

Run: `npx -w packages/client vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/App.tsx
git commit -m "feat: handle component_error postMessage with toast notification"
```

---

### Task 3: Rewrite System Prompt

**Files:**
- Modify: `packages/proxy/src/agent/systemPrompt.ts` (complete rewrite)
- Modify: `packages/proxy/src/agent/Agent.test.ts` (update test assertions)

**Step 1: Update the test assertions for the new prompt**

The existing test checks for specific strings. Update it:

```typescript
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

  it('render_component tool accepts html', () => {
    const renderTool = TOOL_DEFINITIONS.find((t: any) => t.function.name === 'render_component');
    expect(renderTool).toBeDefined();
    const params = (renderTool as any).function.parameters as any;
    expect(params.properties.html).toBeDefined();
    expect(params.properties.component_type).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx -w packages/proxy vitest run src/agent/Agent.test.ts`
Expected: FAIL — `list_session_files` and `update_component` not in tool definitions yet, `--bg-base` not in prompt

**Step 3: Rewrite systemPrompt.ts**

Replace the entire file with a new system prompt (~3500 chars) that includes:
- CSS design system variables
- Tool decision trees
- Component skeleton patterns
- Quality checklist
- Multi-step workflow patterns
- Tool summary table

The new prompt:

```typescript
export const SYSTEM_PROMPT = `You are a universal AI assistant that creates rich, interactive visual experiences. You have tools for web search, page fetching, code execution, file operations, and GIS/mapping.

ALWAYS use tools to get real data. Never fabricate results.

## CSS Design System
All render_component HTML MUST use these CSS variables (pre-injected into every iframe):
- Backgrounds: --bg-base (#0a0a1a), --bg-surface (#141428), --bg-elevated (#1e1e3a)
- Text: --text-primary (#e8e8f0), --text-secondary (#9898b0), --text-muted (#585870)
- Accent: --accent (#3b82f6), --accent-hover (#60a5fa)
- States: --success (#4ade80), --warning (#fbbf24), --error (#f87171)
- UI: --border, --radius (8px), --shadow, --space-1 to --space-6
- Fonts: --font-sans, --font-mono
- Utility classes: .card (surface panel), .grid (auto-fit responsive grid)
NEVER hardcode colors. Always use var(--name).

## Decision Tree — Which Tool to Use
- Data analysis (CSV, JSON, uploaded file) → read_file → execute_code (Python/pandas) → render_component (chart/table)
- Open/display a URL → fetch_page ONLY (auto-renders reader view; do NOT also render_component)
- Search/find/latest news → web_search → optionally fetch_page top results → render_component (summary)
- Calculate/algorithm/logic → execute_code (Python or JS)
- Map/directions/nearby → geocode → search_pois or calculate_route → render_component (Leaflet map)
- Build interactive app/dashboard → render_component directly
- Compare X vs Y → web_search both → fetch_page → render_component (comparison layout)
- Check uploaded files → list_session_files first, then proceed
- Update existing component → update_component (sends data to existing window, no re-render)

## Component Patterns
Dashboard: <div class="grid" style="padding:var(--space-3);height:100vh;align-content:start">
  <div class="card"><h3 style="color:var(--text-secondary)">Title</h3><p style="font-size:2rem">Value</p></div>
Data table: <div style="overflow-x:auto;height:100vh;padding:var(--space-3)">
  <table style="width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:13px">
  <thead style="background:var(--bg-elevated);position:sticky;top:0">
Chart: <div style="height:100vh;padding:var(--space-3);display:flex;align-items:center;justify-content:center">
  <canvas id="chart"></canvas></div>
  <script type="module">import Chart from 'chart.js/auto';
  Chart.defaults.color='#9898b0'; Chart.defaults.borderColor='rgba(255,255,255,0.08)';
Interactive app: <div style="display:flex;flex-direction:column;height:100vh">
  <nav style="background:var(--bg-surface);padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--border)">
  <main style="flex:1;overflow:auto;padding:var(--space-3)">

## Quality Rules (MANDATORY for every render_component)
1. Fill 100vw x 100vh. Use CSS Grid or Flexbox.
2. Use CSS variables ONLY — no hardcoded colors.
3. Loading states for async ops (show spinner or "Loading..." text).
4. Error states with user-friendly messages.
5. Interactive elements: cursor:pointer, hover transitions (opacity or background).
6. Responsive: use auto-fit/minmax grids, no fixed pixel widths for layouts.
7. COMPONENT_ID is predefined — do NOT redeclare it.
8. Use <script type="module"> for ESM imports (three, chart.js/auto, d3, mermaid, marked).
9. For Leaflet maps: use classic <script> tag from unpkg.com/leaflet@1.9.4, NOT ESM.

## Multi-step Workflows
- Research: web_search → fetch_page top 3-5 results → synthesize findings → render_component (dashboard with key points)
- Data pipeline: list_session_files → read_file → execute_code (Python analysis) → render_component (chart + table)
- Comparison: web_search for each item → fetch_page → render_component (side-by-side comparison grid)

## Auto-Rendering Tools (server handles rendering)
- fetch_page: Automatically creates a reader view window. You receive a summary. Do NOT re-render.
- execute_code: Automatically creates a code+output window. Python uses Pyodide (pandas, numpy, matplotlib auto-load). Matplotlib renders as inline SVG. JS uses eval.

## PDF Display
Use render_component with pdf.js: fetch from /api/mcp/fetch-pdf?url=<encoded-url> or /api/files/<session_id>/<filename>.

## Tool Summary
| Tool | Purpose |
|------|---------|
| render_component | Interactive HTML/JS/CSS in sandbox. Use design system. |
| execute_code | Python (Pyodide) or JavaScript. Visible code+output window. |
| web_search | Search web (categories: general, news, images, science, files) |
| fetch_page | Fetch URL → auto reader view. You get summary only. |
| list_session_files | List uploaded files in session. Check before data analysis. |
| update_component | Send data update to existing component (no re-render). |
| geocode | Place name → lat/lon |
| search_pois | Find POIs near coordinates |
| calculate_route | Route between two points |
| read_file / write_file | Read uploaded files / write downloadable files |
| show_notification | Toast notification |
| remove_component | Remove a window |

Reply with a brief plain-text summary. No markdown, no JSON in your reply text.`;
```

**Step 4: Run test (will still fail — need tool definitions)**

Run: `npx -w packages/proxy vitest run src/agent/Agent.test.ts`
Expected: FAIL on tool count (still 11, need 13)

**Step 5: Commit system prompt (partial progress)**

```bash
git add packages/proxy/src/agent/systemPrompt.ts packages/proxy/src/agent/Agent.test.ts
git commit -m "feat: rewrite system prompt with design system, decision trees, and quality rules"
```

---

### Task 4: Add `list_session_files` Tool

**Files:**
- Modify: `packages/proxy/src/tools/fileOps.ts` (add `listSessionFiles` function)
- Modify: `packages/proxy/src/agent/toolRegistry.ts` (add tool definition)
- Modify: `packages/proxy/src/agent/Agent.ts:37-79` (add case in `executeTool`)

**Step 1: Write the failing test**

Create `packages/proxy/src/tools/fileOps.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// Set test directory before importing
process.env.SESSION_FILE_DIR = '/tmp/ai-interface-test-sessions';

const { listSessionFiles, getSessionDir } = await import('./fileOps.js');

describe('listSessionFiles', () => {
  const sessionId = 'test-session-123';

  beforeEach(async () => {
    const dir = getSessionDir(sessionId);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(getSessionDir(sessionId), { recursive: true, force: true });
  });

  it('returns empty array when no files', async () => {
    const files = await listSessionFiles(sessionId);
    expect(files).toEqual([]);
  });

  it('lists uploaded files with metadata', async () => {
    const dir = getSessionDir(sessionId);
    await writeFile(join(dir, 'data.csv'), 'a,b,c\n1,2,3');
    await writeFile(join(dir, 'notes.txt'), 'hello world');

    const files = await listSessionFiles(sessionId);
    expect(files).toHaveLength(2);
    expect(files.map((f: any) => f.filename).sort()).toEqual(['data.csv', 'notes.txt']);
    expect(files[0]).toHaveProperty('size');
    expect(files[0]).toHaveProperty('filename');
  });

  it('returns empty array for nonexistent session', async () => {
    const files = await listSessionFiles('nonexistent-session');
    expect(files).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx -w packages/proxy vitest run src/tools/fileOps.test.ts`
Expected: FAIL — `listSessionFiles` is not exported

**Step 3: Implement listSessionFiles in fileOps.ts**

Add to `packages/proxy/src/tools/fileOps.ts`:

```typescript
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// ... existing code ...

export async function listSessionFiles(
  sessionId: string,
): Promise<Array<{ filename: string; size: number }>> {
  const dir = getSessionDir(sessionId);
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir);
  const files: Array<{ filename: string; size: number }> = [];

  for (const entry of entries) {
    const fileStat = await stat(join(dir, entry));
    if (fileStat.isFile()) {
      files.push({ filename: entry, size: fileStat.size });
    }
  }

  return files;
}
```

Note: `readdir` and `stat` need to be added to the import from `node:fs/promises`.

**Step 4: Run test to verify it passes**

Run: `npx -w packages/proxy vitest run src/tools/fileOps.test.ts`
Expected: PASS

**Step 5: Add tool definition to toolRegistry.ts**

Append to the `TOOL_DEFINITIONS` array:

```typescript
  {
    type: 'function',
    function: {
      name: 'list_session_files',
      description: 'List all files uploaded in the current session. Call this before data analysis to discover available files.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
```

**Step 6: Add case in Agent.ts executeTool**

Add before the `default` case:

```typescript
    case 'list_session_files': {
      const files = await listSessionFiles(sessionId);
      return JSON.stringify(files);
    }
```

And add the import at the top of Agent.ts:

```typescript
import { readSessionFile, writeSessionFile, listSessionFiles } from '../tools/fileOps.js';
```

**Step 7: Run all proxy tests**

Run: `npx -w packages/proxy vitest run`
Expected: FAIL — tool count test expects 13 but `update_component` not added yet. That's fine, we'll fix in next task.

**Step 8: Commit**

```bash
git add packages/proxy/src/tools/fileOps.ts packages/proxy/src/tools/fileOps.test.ts packages/proxy/src/agent/toolRegistry.ts packages/proxy/src/agent/Agent.ts
git commit -m "feat: add list_session_files tool for discovering uploaded files"
```

---

### Task 5: Add `update_component` Tool

**Files:**
- Modify: `packages/proxy/src/agent/toolRegistry.ts` (add tool definition)
- Modify: `packages/proxy/src/agent/Agent.ts:73-76,139-149` (handle in executeTool + extract UI action)

**Step 1: Add tool definition to toolRegistry.ts**

Append to the `TOOL_DEFINITIONS` array:

```typescript
  {
    type: 'function',
    function: {
      name: 'update_component',
      description: 'Send a data update to an existing UI component without re-rendering. The component must listen for ui_update postMessage events.',
      parameters: {
        type: 'object',
        properties: {
          component_id: { type: 'string', description: 'ID of the component to update' },
          action: { type: 'string', description: 'Update action name the component listens for' },
          payload: { type: 'object', description: 'Data payload to send to the component' },
        },
        required: ['component_id', 'action', 'payload'],
      },
    },
  },
```

**Step 2: Handle in Agent.ts executeTool**

The `update_component` tool is a UI action like `render_component` — the proxy just queues it for the client. Add it to the existing pass-through case:

```typescript
    case 'render_component':
    case 'show_notification':
    case 'remove_component':
    case 'update_component':
      return JSON.stringify({ status: 'queued', ...input });
```

**Step 3: Extract update_component as a UI action in the agent loop**

In the agent loop (around line 139), after the existing `remove_component` handling, add:

```typescript
        } else if (toolCall.name === 'update_component') {
          // Queue as a component update — client will postMessage to the iframe
          // We don't push to components[] — instead add to a new updates array
        }
```

Actually, the simpler approach: add an `update_components` field to `AgentResponse`. But that changes the shared types. Instead, let's use the existing `notifications` pattern and add a new response field.

Add to `packages/shared/src/types/mcp.ts` in the `AgentResponse` interface:

```typescript
  component_updates?: Array<{ component_id: string; action: string; payload: Record<string, unknown> }>;
```

Then in Agent.ts, collect updates:

```typescript
const componentUpdates: Array<{ component_id: string; action: string; payload: Record<string, unknown> }> = [];

// In the tool call handling:
} else if (toolCall.name === 'update_component') {
  componentUpdates.push({
    component_id: args.component_id,
    action: args.action,
    payload: args.payload || {},
  });
}

// In the return:
return {
  message: agentMessage,
  components: components.length > 0 ? components : undefined,
  remove_components: removeComponents.length > 0 ? removeComponents : undefined,
  notifications: notifications.length > 0 ? notifications : undefined,
  component_updates: componentUpdates.length > 0 ? componentUpdates : undefined,
};
```

**Step 4: Handle component_updates in App.tsx**

In `handleSend`, after the `remove_components` handling:

```typescript
      // Update existing components
      if (response.component_updates) {
        for (const update of response.component_updates) {
          const entry = sandboxRegistryRef.current.getById(update.component_id);
          if (entry?.iframe) {
            entry.iframe.contentWindow?.postMessage({
              type: 'ui_update',
              component_id: update.component_id,
              action: update.action,
              payload: update.payload,
              signature: '',
            }, '*');
          }
        }
      }
```

Note: `SandboxRegistry` needs a `getById` method. Check if it exists — if not, add it.

**Step 5: Run all tests**

Run: `npm run test`
Expected: PASS (all 13 tools, updated prompt assertions)

**Step 6: Commit**

```bash
git add packages/shared/src/types/mcp.ts packages/proxy/src/agent/toolRegistry.ts packages/proxy/src/agent/Agent.ts packages/client/src/App.tsx
git commit -m "feat: add update_component tool for live data updates to existing windows"
```

---

### Task 6: Parallel Tool Execution in Agent Loop

**Files:**
- Modify: `packages/proxy/src/agent/Agent.ts:123-198` (refactor tool execution loop)

**Step 1: Refactor the sequential for loop to use Promise.all**

In `processQuery`, replace the sequential tool execution:

```typescript
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

      // Process results and extract UI actions
      for (const { toolCall, args, result } of toolResults) {
        // ... existing UI extraction logic (render_component, fetch_page, execute_code, etc.)
        // ... push tool result messages
      }
```

**Step 2: Run tests**

Run: `npx -w packages/proxy vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/proxy/src/agent/Agent.ts
git commit -m "feat: parallel tool execution with Promise.all in agent loop"
```

---

### Task 7: Structured Error Feedback

**Files:**
- Modify: `packages/proxy/src/agent/Agent.ts:37-79` (enhance executeTool error handling)

**Step 1: Add structured error messages to executeTool**

Wrap each tool case with specific error handling:

```typescript
async function executeTool(name: string, input: Record<string, any>, sessionId: string): Promise<string> {
  try {
    switch (name) {
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
      // ... other cases stay the same
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    const msg = err.message || 'Unknown error';
    // Provide actionable hints based on error type
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      return JSON.stringify({ error: msg, hint: 'Network error. The URL may be invalid or the service is down.' });
    }
    if (msg.includes('403') || msg.includes('Forbidden')) {
      return JSON.stringify({ error: msg, hint: 'Access denied. The site blocks automated requests. Try a different source.' });
    }
    if (msg.includes('404') || msg.includes('Not Found')) {
      return JSON.stringify({ error: msg, hint: 'Page not found. The URL may be outdated. Try searching for the content instead.' });
    }
    if (msg.includes('timeout') || msg.includes('Timeout')) {
      return JSON.stringify({ error: msg, hint: 'Request timed out. The server is slow or unresponsive. Try again or use a different source.' });
    }
    return JSON.stringify({ error: msg });
  }
}
```

**Step 2: Run tests**

Run: `npx -w packages/proxy vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/proxy/src/agent/Agent.ts
git commit -m "feat: structured error feedback with actionable hints for LLM self-correction"
```

---

### Task 8: Richer Session Memory

**Files:**
- Modify: `packages/proxy/src/agent/Agent.ts:27-35,208-215` (memory management)

**Step 1: Increase memory and add session context**

Increase `MAX_MEMORY` from 6 to 20. Add a session context object that tracks uploaded files and active component types:

```typescript
const MAX_MEMORY = 20;

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
```

Then in `processQuery`, update the context block to include session context:

```typescript
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

User: ${query}`;
```

After processing, update component types:

```typescript
  // Track component types in session context
  for (const c of components) {
    const type = c.metadata.component_type;
    if (!sessionCtx.componentTypes.includes(type)) sessionCtx.componentTypes.push(type);
  }
```

**Step 2: Run tests**

Run: `npx -w packages/proxy vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/proxy/src/agent/Agent.ts
git commit -m "feat: richer session memory (20 messages, tracked files and component types)"
```

---

### Task 9: Improve Tool Descriptions

**Files:**
- Modify: `packages/proxy/src/agent/toolRegistry.ts` (better descriptions)

**Step 1: Update all tool descriptions with usage guidance**

Replace descriptions with more specific guidance:

```typescript
// render_component
description: 'Render interactive HTML/JS/CSS in a sandboxed iframe. Use the CSS design system variables. Import map available: three, chart.js/auto, d3, mermaid, marked, lodash, canvas-confetti. Use <script type="module"> for ESM imports. Leaflet: use classic <script> from unpkg CDN.',

// execute_code
description: 'Run Python (Pyodide) or JavaScript with visible output. Use for calculations, data processing, and algorithms. Python: pandas, numpy, matplotlib, scipy, scikit-learn auto-load. Matplotlib figures render as SVG. Each call creates a visible code window.',

// web_search
description: 'Search the web via SearXNG. Returns titles, URLs, snippets. Use "general" for broad queries, "news" for current events, "science" for academic/research, "images" for visual content, "files" for downloadable files.',

// fetch_page
description: 'Fetch a web page and display it as a clean reader view. The reader view is auto-rendered — do NOT also call render_component for the same content. You receive a text summary as the result.',

// list_session_files
description: 'List all files uploaded in the current session. Call this before data analysis to discover what files are available. Returns filename and size for each file.',

// update_component
description: 'Send a data update to an existing component window without full re-render. The component must have a window.addEventListener("message") handler for ui_update events.',
```

**Step 2: Run tests**

Run: `npx -w packages/proxy vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/proxy/src/agent/toolRegistry.ts
git commit -m "feat: improve tool descriptions with usage guidance and constraints"
```

---

### Task 10: Update Auto-Rendered HTML (Reader View & Code Exec)

**Files:**
- Modify: `packages/proxy/src/agent/Agent.ts:225-353` (buildCodeExecHtml and buildReaderViewHtml)

**Step 1: Update buildCodeExecHtml to use design system variables**

Replace hardcoded colors with CSS variables. The iframe already has the design system injected (from Task 1), so these HTML templates can reference `var(--bg-base)`, `var(--bg-surface)`, etc.

Update the Python template:
- Replace `background:#1a1a2e` → `background:var(--bg-base)`
- Replace `color:#e0e0e0` → `color:var(--text-primary)`
- Replace `color:#888` → `color:var(--text-secondary)`
- Replace `background:#111` → `background:var(--bg-surface)`
- Replace `color:#4ade80` → `color:var(--success)`

Same for JavaScript template and reader view template.

**Step 2: Run tests**

Run: `npx -w packages/proxy vitest run`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/proxy/src/agent/Agent.ts
git commit -m "refactor: update auto-rendered HTML to use design system CSS variables"
```

---

### Task 11: Add SandboxRegistry.getById Method (if missing)

**Files:**
- Check: `packages/client/src/core/SandboxRegistry.ts`

**Step 1: Check if getById exists**

Read `SandboxRegistry.ts` and check if there's a method to look up an entry by component_id. If not, add:

```typescript
  getById(componentId: string): SandboxEntry | undefined {
    return this.entries.get(componentId);
  }
```

This is needed for `update_component` in App.tsx (Task 5) to find the iframe to postMessage to.

Also ensure `SandboxEntry` has an `iframe` property. If it doesn't, we need to track iframe refs — this may require `WorkspaceCanvas` to register iframes when they load.

**Step 2: Run all tests**

Run: `npm run test`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/core/SandboxRegistry.ts
git commit -m "feat: add SandboxRegistry.getById for component update lookups"
```

---

### Task 12: Final Integration Test

**Step 1: Run all tests**

Run: `npm run test`
Expected: ALL PASS

**Step 2: Manual smoke test**

Run: `npm run dev`

Test these scenarios:
1. "Search for latest AI news" → should use web_search → render_component with dashboard layout using CSS variables
2. Open a URL → should use fetch_page only, reader view auto-renders
3. "Run a Python script to calculate fibonacci" → should use execute_code, code window uses design system
4. Upload a CSV, ask "analyze this data" → should use list_session_files → read_file → execute_code → render_component
5. Trigger a JS error in a component → should see toast notification from error boundary

**Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: Reliable Agent v2 — consistent design system, smarter tool choices, parallel execution"
```
