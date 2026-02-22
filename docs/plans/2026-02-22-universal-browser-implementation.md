# Universal Browser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the GIS-only agent into a universal browser with web search, page fetching, code execution, file I/O, and a tiling window manager.

**Architecture:** Evolutionary extension — add new tools to existing agent loop, generalize the system prompt, replace vertical scroll layout with react-grid-layout tiling. No rewrite of security/crypto/session layers.

**Tech Stack:** react-grid-layout (tiling), @mozilla/readability + jsdom (page extraction), multer (uploads), Pyodide (in-browser Python), SearXNG (search)

---

### Task 1: Generalize System Prompt and Rename Agent

**Files:**
- Modify: `packages/proxy/src/agent/systemPrompt.ts`
- Rename: `packages/proxy/src/agent/GisAgent.ts` → `packages/proxy/src/agent/Agent.ts`
- Modify: `packages/proxy/src/routes/mcp.ts` (update import)
- Modify: `packages/proxy/src/agent/GisAgent.test.ts` → rename to `Agent.test.ts`

**Step 1: Replace system prompt**

```typescript
// packages/proxy/src/agent/systemPrompt.ts
export const SYSTEM_PROMPT = `You are a universal AI assistant with access to tools for web search, page fetching, code execution, file operations, and GIS/mapping.

ALWAYS use tools to get real data. Never fabricate results.

Workflow:
1. Analyze what the user needs
2. Call appropriate tools to gather data or perform actions
3. Call render_component to display results visually

render_component types and when to use them:
- map_view: Location data → Leaflet map (CDN: unpkg.com/leaflet@1.9.4)
- data_table: Structured data → sortable HTML table
- chart: Numeric data → Chart.js visualization (CDN: cdn.jsdelivr.net/npm/chart.js)
- web_page: Fetched page content → readable HTML view
- code_output: Code execution → code + output display
- markdown: Long-form text/analysis → rendered markdown
- image: Image URLs → image display
- download: Generated files → download link

HTML rules for render_component:
- Self-contained. All CSS/JS inline except CDN libs above.
- COMPONENT_ID is predefined — do NOT redeclare it.
- Dark theme: #1a1a2e bg, #e0e0e0 text.
- Fill viewport: 100vw x 100vh. Keep HTML concise.

Reply with a brief plain-text summary. No markdown, no JSON.`;
```

**Step 2: Rename GisAgent.ts → Agent.ts**

```bash
mv packages/proxy/src/agent/GisAgent.ts packages/proxy/src/agent/Agent.ts
mv packages/proxy/src/agent/GisAgent.test.ts packages/proxy/src/agent/Agent.test.ts
```

**Step 3: Update import in mcp.ts route**

```typescript
// packages/proxy/src/routes/mcp.ts line 2
import { processQuery } from '../agent/Agent.js';
```

**Step 4: Update test file imports and assertions**

In `Agent.test.ts`, update the system prompt assertions to check for the new universal content (`web search`, `render_component`, `COMPONENT_ID`).

**Step 5: Run tests**

Run: `npm run test`
Expected: All 18 tests pass

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: generalize agent from GIS-only to universal assistant"
```

---

### Task 2: Add Web Search Tool (SearXNG)

**Files:**
- Create: `packages/proxy/src/tools/webSearch.ts`
- Create: `packages/proxy/src/tools/webSearch.test.ts`
- Modify: `packages/proxy/src/agent/toolRegistry.ts` (add web_search definition)
- Modify: `packages/proxy/src/agent/Agent.ts` (add executeTool case)

**Step 1: Write the test**

```typescript
// packages/proxy/src/tools/webSearch.test.ts
import { describe, it, expect } from 'vitest';
import { webSearch } from './webSearch.js';

describe('webSearch', () => {
  it('exports a webSearch function', () => {
    expect(typeof webSearch).toBe('function');
  });

  it('returns an array', async () => {
    // Will fail against real SearXNG if not running — that's fine for unit test
    // We test the shape, not the network
    const result = await webSearch('test', 'general').catch(() => []);
    expect(Array.isArray(result)).toBe(true);
  });
});
```

**Step 2: Implement webSearch**

```typescript
// packages/proxy/src/tools/webSearch.ts
const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8080';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: string;
}

export async function webSearch(
  query: string,
  category: string = 'general',
  limit: number = 10,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: category,
  });

  const response = await fetch(`${SEARXNG_URL}/search?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`SearXNG error: ${response.status}`);
  }

  const data = await response.json();
  return (data.results || []).slice(0, limit).map((r: any) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    engine: r.engine || '',
  }));
}
```

**Step 3: Add tool definition to toolRegistry.ts**

Add to the `TOOL_DEFINITIONS` array:

```typescript
{
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web via SearXNG. Returns titles, URLs, snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', enum: ['general', 'news', 'images', 'science', 'files'], description: 'Search category (default general)' },
      },
      required: ['query'],
    },
  },
},
```

**Step 4: Add executeTool case in Agent.ts**

Add import and case:

```typescript
import { webSearch } from '../tools/webSearch.js';

// In executeTool switch:
case 'web_search': {
  const results = await webSearch(input.query, input.category);
  return JSON.stringify(results);
}
```

**Step 5: Run tests**

Run: `npm run test`
Expected: All tests pass (including new webSearch tests)

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add web_search tool with SearXNG integration"
```

---

### Task 3: Add Page Fetch Tool

**Files:**
- Create: `packages/proxy/src/tools/fetchPage.ts`
- Create: `packages/proxy/src/tools/fetchPage.test.ts`
- Modify: `packages/proxy/src/agent/toolRegistry.ts`
- Modify: `packages/proxy/src/agent/Agent.ts`

**Step 1: Install dependencies**

```bash
npm -w packages/proxy install @mozilla/readability jsdom
npm -w packages/proxy install -D @types/jsdom
```

**Step 2: Write the test**

```typescript
// packages/proxy/src/tools/fetchPage.test.ts
import { describe, it, expect } from 'vitest';
import { fetchPage } from './fetchPage.js';

describe('fetchPage', () => {
  it('exports a fetchPage function', () => {
    expect(typeof fetchPage).toBe('function');
  });
});
```

**Step 3: Implement fetchPage**

```typescript
// packages/proxy/src/tools/fetchPage.ts
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface PageContent {
  title: string;
  content: string;
  text_content: string;
  excerpt: string;
  byline: string;
  length: number;
  mime_type: string;
}

export async function fetchPage(url: string): Promise<PageContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AIInterface/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/json,text/plain,*/*',
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Fetch error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();

  // Non-HTML: return raw content
  if (!contentType.includes('html')) {
    return {
      title: url,
      content: body.slice(0, 50_000),
      text_content: body.slice(0, 50_000),
      excerpt: body.slice(0, 200),
      byline: '',
      length: body.length,
      mime_type: contentType.split(';')[0].trim(),
    };
  }

  // HTML: extract with Readability
  const dom = new JSDOM(body, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    return {
      title: dom.window.document.title || url,
      content: body.slice(0, 50_000),
      text_content: dom.window.document.body?.textContent?.slice(0, 50_000) || '',
      excerpt: '',
      byline: '',
      length: body.length,
      mime_type: 'text/html',
    };
  }

  return {
    title: article.title,
    content: article.content.slice(0, 50_000),
    text_content: article.textContent.slice(0, 50_000),
    excerpt: article.excerpt || '',
    byline: article.byline || '',
    length: article.length,
    mime_type: 'text/html',
  };
}
```

**Step 4: Add tool definition and executeTool case**

Tool definition:
```typescript
{
  type: 'function',
  function: {
    name: 'fetch_page',
    description: 'Fetch a web page and extract readable content.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
},
```

Agent case:
```typescript
import { fetchPage } from '../tools/fetchPage.js';

case 'fetch_page': {
  const content = await fetchPage(input.url);
  return JSON.stringify(content);
}
```

**Step 5: Run tests, commit**

```bash
npm run test
git add -A && git commit -m "feat: add fetch_page tool with Readability extraction"
```

---

### Task 4: Add Code Execution Tool (Browser/Pyodide)

**Files:**
- Create: `packages/proxy/src/tools/codeExec.ts`
- Create: `packages/proxy/src/tools/codeExec.test.ts`
- Modify: `packages/proxy/src/agent/toolRegistry.ts`
- Modify: `packages/proxy/src/agent/Agent.ts`

**Step 1: Write the test**

```typescript
// packages/proxy/src/tools/codeExec.test.ts
import { describe, it, expect } from 'vitest';
import { prepareCodeExec } from './codeExec.js';

describe('codeExec', () => {
  it('returns code payload for browser execution', () => {
    const result = prepareCodeExec('print("hello")', 'python');
    expect(result.runtime).toBe('browser');
    expect(result.code).toBe('print("hello")');
    expect(result.language).toBe('python');
  });

  it('returns code payload for javascript', () => {
    const result = prepareCodeExec('console.log(1+1)', 'javascript');
    expect(result.language).toBe('javascript');
  });
});
```

**Step 2: Implement codeExec**

```typescript
// packages/proxy/src/tools/codeExec.ts
export interface CodeExecPayload {
  runtime: 'browser';
  language: 'python' | 'javascript';
  code: string;
}

export function prepareCodeExec(
  code: string,
  language: string = 'python',
): CodeExecPayload {
  return {
    runtime: 'browser',
    language: language === 'javascript' ? 'javascript' : 'python',
    code,
  };
}
```

**Step 3: Add tool definition and executeTool case**

Tool definition:
```typescript
{
  type: 'function',
  function: {
    name: 'execute_code',
    description: 'Execute Python or JavaScript code. Results shown in browser via Pyodide (Python) or direct eval (JS).',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', enum: ['python', 'javascript'], description: 'Language (default python)' },
      },
      required: ['code'],
    },
  },
},
```

Agent case — for code execution, the agent should render it as a component so the client can run it in an iframe. Add special handling in processQuery after executeTool:

```typescript
import { prepareCodeExec } from '../tools/codeExec.js';

case 'execute_code': {
  const payload = prepareCodeExec(input.code, input.language);
  return JSON.stringify(payload);
}
```

Then in the tool_call processing section of processQuery, after `executeTool`, add handling for `execute_code` that creates a render_component automatically:

```typescript
} else if (toolCall.name === 'execute_code') {
  const payload = JSON.parse(result) as { runtime: string; language: string; code: string };
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
```

Add helper function at the bottom of Agent.ts:

```typescript
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
} catch(e) { _log.push('Error: ' + e.message); }
document.getElementById('output').textContent = _log.join('\\n');
</script></div>`;
  }

  // Python via Pyodide
  return `<div style="background:#1a1a2e;color:#e0e0e0;font-family:monospace;padding:16px;width:100vw;height:100vh;overflow:auto">
<h3 style="color:#888;margin:0 0 8px">Python</h3>
<pre style="background:#111;padding:12px;border-radius:4px;margin:0 0 8px;overflow-x:auto"><code>${escaped}</code></pre>
<h3 style="color:#888;margin:0 0 8px">Output</h3>
<pre id="output" style="background:#111;padding:12px;border-radius:4px;color:#4ade80;overflow-x:auto">Loading Pyodide...</pre>
<script src="https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js"></script>
<script>
(async () => {
  try {
    const pyodide = await loadPyodide();
    pyodide.setStdout({ batched: (text) => {
      const el = document.getElementById('output');
      if (el.textContent === 'Loading Pyodide...') el.textContent = '';
      el.textContent += text + '\\n';
    }});
    pyodide.setStderr({ batched: (text) => {
      const el = document.getElementById('output');
      el.textContent += text + '\\n';
    }});
    const result = await pyodide.runPythonAsync(${JSON.stringify(code)});
    if (result !== undefined && result !== null) {
      const el = document.getElementById('output');
      if (el.textContent === 'Loading Pyodide...') el.textContent = '';
      el.textContent += String(result);
    }
    if (document.getElementById('output').textContent === 'Loading Pyodide...') {
      document.getElementById('output').textContent = '(no output)';
    }
  } catch(e) {
    document.getElementById('output').textContent = 'Error: ' + e.message;
  }
})();
</script></div>`;
}
```

**Step 4: Update SandboxFrame.tsx CSP to allow Pyodide CDN**

In `packages/client/src/components/SandboxFrame.tsx`, the CSP already allows `https://cdn.jsdelivr.net` for scripts. Pyodide also needs to fetch WASM files, so `connect-src https:` (already set) covers it. No change needed.

**Step 5: Run tests, commit**

```bash
npm run test
git add -A && git commit -m "feat: add execute_code tool with Pyodide and JS support"
```

---

### Task 5: Add File I/O Tools and Routes

**Files:**
- Create: `packages/proxy/src/tools/fileOps.ts`
- Create: `packages/proxy/src/tools/fileOps.test.ts`
- Create: `packages/proxy/src/routes/upload.ts`
- Create: `packages/proxy/src/routes/files.ts`
- Modify: `packages/proxy/src/agent/toolRegistry.ts`
- Modify: `packages/proxy/src/agent/Agent.ts`
- Modify: `packages/proxy/src/server.ts`

**Step 1: Install multer**

```bash
npm -w packages/proxy install multer
npm -w packages/proxy install -D @types/multer
```

**Step 2: Write the test**

```typescript
// packages/proxy/src/tools/fileOps.test.ts
import { describe, it, expect } from 'vitest';
import { readSessionFile, writeSessionFile, getSessionDir } from './fileOps.js';

describe('fileOps', () => {
  it('exports read and write functions', () => {
    expect(typeof readSessionFile).toBe('function');
    expect(typeof writeSessionFile).toBe('function');
    expect(typeof getSessionDir).toBe('function');
  });
});
```

**Step 3: Implement fileOps**

```typescript
// packages/proxy/src/tools/fileOps.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const SESSION_FILE_DIR = process.env.SESSION_FILE_DIR || '/tmp/ai-interface-sessions';

export function getSessionDir(sessionId: string): string {
  return join(SESSION_FILE_DIR, sessionId.replace(/[^a-zA-Z0-9-]/g, ''));
}

export async function readSessionFile(
  sessionId: string,
  filename: string,
): Promise<{ content: string; mime_type: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(getSessionDir(sessionId), safeName);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${safeName}`);
  }

  const content = await readFile(filePath, 'utf-8');
  const ext = safeName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    csv: 'text/csv', json: 'application/json', txt: 'text/plain',
    html: 'text/html', md: 'text/markdown', js: 'text/javascript',
    py: 'text/x-python', xml: 'application/xml', yaml: 'text/yaml',
  };

  return { content, mime_type: mimeMap[ext] || 'text/plain' };
}

export async function writeSessionFile(
  sessionId: string,
  filename: string,
  content: string,
): Promise<{ path: string; download_url: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const dir = getSessionDir(sessionId);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, safeName);
  await writeFile(filePath, content, 'utf-8');

  return {
    path: filePath,
    download_url: `/api/files/${sessionId}/${safeName}`,
  };
}
```

**Step 4: Create upload route**

```typescript
// packages/proxy/src/routes/upload.ts
import { Router } from 'express';
import multer from 'multer';
import { getSessionDir } from '../tools/fileOps.js';
import { mkdir } from 'node:fs/promises';

export const uploadRouter = Router();

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const sessionId = (req as any).session?.sid || 'anonymous';
    const dir = getSessionDir(sessionId);
    await mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, safeName);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

uploadRouter.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const sessionId = (req as any).session?.sid || 'anonymous';
  res.json({
    filename: req.file.filename,
    size: req.file.size,
    download_url: `/api/files/${sessionId}/${req.file.filename}`,
  });
});
```

**Step 5: Create files download route**

```typescript
// packages/proxy/src/routes/files.ts
import { Router } from 'express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getSessionDir } from '../tools/fileOps.js';

export const filesRouter = Router();

filesRouter.get('/files/:sessionId/:filename', (req, res) => {
  const { sessionId, filename } = req.params;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(getSessionDir(sessionId), safeName);

  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.download(filePath, safeName);
});
```

**Step 6: Add tool definitions and executeTool cases**

Tool definitions:
```typescript
{
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read a user-uploaded file from the session.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Filename to read' },
      },
      required: ['filename'],
    },
  },
},
{
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Write a file to the session, making it downloadable.',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Filename to create' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['filename', 'content'],
    },
  },
},
```

Agent cases:
```typescript
import { readSessionFile, writeSessionFile } from '../tools/fileOps.js';

case 'read_file': {
  const result = await readSessionFile(context.session_id, input.filename);
  return JSON.stringify(result);
}
case 'write_file': {
  const result = await writeSessionFile(context.session_id, input.filename, input.content);
  return JSON.stringify(result);
}
```

Note: `executeTool` needs access to `context.session_id`. Change its signature:

```typescript
async function executeTool(name: string, input: Record<string, any>, sessionId: string): Promise<string>
```

And update the call site to pass `context.session_id`.

**Step 7: Mount routes in server.ts**

```typescript
import { uploadRouter } from './routes/upload.js';
import { filesRouter } from './routes/files.js';

// After the existing protected routes line:
app.use('/api/mcp', uploadRouter);

// Public file download (no session needed, file path is the auth)
app.use('/api', filesRouter);
```

**Step 8: Update .env.example**

Add:
```
SEARXNG_URL=http://localhost:8080
SESSION_FILE_DIR=/tmp/ai-interface-sessions
```

**Step 9: Run tests, commit**

```bash
npm run test
git add -A && git commit -m "feat: add file I/O tools, upload and download routes"
```

---

### Task 6: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types/mcp.ts`

**Step 1: Add uploaded_files to AgentContext**

```typescript
export interface AgentContext {
  session_id: string;
  active_components: string[];
  viewport?: { center: [number, number]; zoom: number };
  conversation_summary?: string;
  last_user_intent?: { type: string; payload: Record<string, unknown> };
  uploaded_files?: string[];  // filenames available in session dir
}
```

**Step 2: Build shared**

```bash
npm -w packages/shared run build
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add uploaded_files to AgentContext type"
```

---

### Task 7: Tiling Window Manager (react-grid-layout)

**Files:**
- Modify: `packages/client/src/components/WorkspaceCanvas.tsx` (full rewrite)
- Modify: `packages/client/src/App.tsx` (layout state management)

**Step 1: Install react-grid-layout**

```bash
npm -w packages/client install react-grid-layout
npm -w packages/client install -D @types/react-grid-layout
```

**Step 2: Rewrite WorkspaceCanvas.tsx**

```typescript
// packages/client/src/components/WorkspaceCanvas.tsx
import { useCallback, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { SandboxFrame } from './SandboxFrame.js';
import type { UIComponentPayload } from '@ai-interface/shared';
import type { SandboxRegistry } from '../core/SandboxRegistry.js';

const ResponsiveGrid = WidthProvider(Responsive);

interface WorkspaceCanvasProps {
  components: UIComponentPayload[];
  sandboxRegistry: SandboxRegistry;
  onRemoveComponent: (id: string) => void;
  onClearAll: () => void;
}

export function WorkspaceCanvas({ components, sandboxRegistry, onRemoveComponent, onClearAll }: WorkspaceCanvasProps) {
  const handleSandboxLoad = useCallback(
    (component: UIComponentPayload, iframe: HTMLIFrameElement) => {
      sandboxRegistry.register(component.component_id, iframe, component.metadata);
    },
    [sandboxRegistry],
  );

  const layouts = useMemo(() => {
    return components.map((c, i) => ({
      i: c.component_id,
      x: 0,
      y: i * 6,
      w: 12,
      h: 6,
      minW: 4,
      minH: 3,
    }));
  }, [components]);

  if (components.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#666', fontSize: '14px',
      }}>
        Ask me anything. Try "Search for latest AI news" or "Find cafes in Amsterdam".
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '4px 8px', display: 'flex', justifyContent: 'flex-end',
        borderBottom: '1px solid #222', flexShrink: 0,
      }}>
        <button
          onClick={onClearAll}
          style={{
            background: 'none', border: '1px solid #444', color: '#888',
            padding: '2px 10px', borderRadius: '4px', cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Clear All
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ResponsiveGrid
          layouts={{ lg: layouts }}
          breakpoints={{ lg: 800, sm: 0 }}
          cols={{ lg: 12, sm: 6 }}
          rowHeight={60}
          compactType="vertical"
          draggableHandle=".tile-handle"
          isResizable={true}
          isDraggable={true}
        >
          {components.map(component => (
            <div key={component.component_id} style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div className="tile-handle" style={{
                padding: '4px 8px', background: 'rgba(0,0,0,0.6)',
                fontSize: '11px', color: '#888',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'grab', flexShrink: 0,
              }}>
                <span>{component.metadata.component_type} — {component.component_id}</span>
                <button
                  onClick={() => onRemoveComponent(component.component_id)}
                  style={{
                    background: 'none', border: 'none', color: '#888',
                    cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                    padding: '0 4px',
                  }}
                  title="Close"
                >
                  x
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <SandboxFrame
                  component={component}
                  onLoad={(iframe) => handleSandboxLoad(component, iframe)}
                />
              </div>
            </div>
          ))}
        </ResponsiveGrid>
      </div>
    </div>
  );
}
```

**Step 3: Run tests, verify build**

```bash
npm run test
npm -w packages/client run build
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: replace vertical scroll with react-grid-layout tiling"
```

---

### Task 8: Update ChatPanel for Universal Use

**Files:**
- Modify: `packages/client/src/components/ChatPanel.tsx`

**Step 1: Update suggestions, placeholder, header, and add upload button**

Replace the hardcoded GIS content:

```typescript
// Suggestions — replace the existing array
const suggestions = [
  'Search for latest AI news',
  'Find cafes in Amsterdam',
  'Analyze this CSV data',
  'Explain quantum computing',
];
```

Update header text:
```typescript
// Replace "AI Interface" header
AI Assistant
```

Update placeholder text:
```typescript
// Replace "Ask me anything about maps..."
"Ask me anything..."
```

Update initial greeting:
```typescript
// Replace "Hello! I'm your GIS assistant..."
"Hello! I can search the web, show maps, run code, analyze data, and more. What would you like to do?"
```

Add an upload button next to the Send button in the form:

```typescript
<label style={{
  padding: '8px 12px', borderRadius: '8px', border: '1px solid #444',
  background: '#1a1a1a', color: '#888', fontSize: '13px',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
}}>
  <input
    type="file"
    style={{ display: 'none' }}
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onUpload?.(file);
      e.target.value = '';
    }}
  />
  Upload
</label>
```

Add `onUpload` to the props interface:
```typescript
interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  onUpload?: (file: File) => void;
  isLoading: boolean;
}
```

**Step 2: Wire up upload in App.tsx**

Add upload handler:
```typescript
const handleUpload = useCallback(async (file: File) => {
  if (!sessionManagerRef.current) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const token = sessionManagerRef.current.getToken();
    const res = await fetch(`${PROXY_URL}/api/mcp/upload`, {
      method: 'POST',
      headers: { 'X-Session-Token': token || '' },
      body: formData,
    });
    const data = await res.json();
    addNotification('success', `Uploaded: ${data.filename}`);
    // Send a chat message so the agent knows about the file
    handleSend(`I uploaded a file: ${data.filename}`);
  } catch (err: any) {
    addNotification('error', `Upload failed: ${err.message}`);
  }
}, [addNotification, handleSend]);
```

Pass to ChatPanel:
```typescript
<ChatPanel
  messages={messages}
  onSend={handleSend}
  onUpload={handleUpload}
  isLoading={isLoading}
/>
```

**Step 3: Run tests, commit**

```bash
npm run test
git add -A && git commit -m "feat: update ChatPanel for universal use with upload support"
```

---

### Task 9: Update .env.example and SandboxFrame CSP

**Files:**
- Modify: `.env.example`
- Modify: `packages/client/src/components/SandboxFrame.tsx`

**Step 1: Update .env.example**

Add new env vars:
```
SEARXNG_URL=http://localhost:8080
SESSION_FILE_DIR=/tmp/ai-interface-sessions
```

**Step 2: Update SandboxFrame CSP for Pyodide**

Pyodide loads from `cdn.jsdelivr.net` (already allowed in script-src) and fetches `.wasm` files. The current `connect-src https:` allows this. But Pyodide also needs `worker-src` for Web Workers:

In `buildSrcDoc`, update the CSP:

```
default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://unpkg.com; img-src https: data: blob:; connect-src https: blob:; worker-src blob:;
```

Note: `'unsafe-eval'` is needed for Pyodide's Python eval. `worker-src blob:` allows Pyodide's web workers.

**Step 3: Run tests, commit**

```bash
npm run test
git add -A && git commit -m "feat: update CSP for Pyodide, add new env vars to example"
```

---

### Task 10: Integration Test and Verify

**Files:**
- Modify: `packages/proxy/src/agent/Agent.test.ts`

**Step 1: Update agent tests for new tools**

```typescript
it('has all required tool definitions', () => {
  const toolNames = TOOL_DEFINITIONS.map(t => t.function.name);
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
});

it('system prompt covers universal capabilities', () => {
  expect(SYSTEM_PROMPT).toContain('web search');
  expect(SYSTEM_PROMPT).toContain('code execution');
  expect(SYSTEM_PROMPT).toContain('render_component');
  expect(SYSTEM_PROMPT).toContain('COMPONENT_ID');
  expect(SYSTEM_PROMPT).toContain('data_table');
  expect(SYSTEM_PROMPT).toContain('code_output');
});
```

**Step 2: Run full test suite**

```bash
npm run test
```

Expected: All tests pass across all 3 packages.

**Step 3: Build all packages**

```bash
npm run build
```

**Step 4: Manual smoke test**

Start both servers:
```bash
npx tsx packages/proxy/src/server.ts &
npm -w packages/client run dev &
```

Test in browser:
1. "Search for latest AI news" → should call web_search, render data_table
2. "Show me Amsterdam on a map" → should still work (GIS tools preserved)
3. "Calculate fibonacci(20) in Python" → should call execute_code, render code_output with Pyodide

**Step 5: Commit**

```bash
git add -A && git commit -m "test: update integration tests for universal browser tools"
```

---

### Task 11: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the project description and tool list**

Update CLAUDE.md to reflect the universal browser architecture: new tools (web_search, fetch_page, execute_code, read_file, write_file), tiling layout, configurable LLM provider, SearXNG dependency. Remove GIS-only language.

**Step 2: Commit**

```bash
git add CLAUDE.md && git commit -m "docs: update CLAUDE.md for universal browser"
```
