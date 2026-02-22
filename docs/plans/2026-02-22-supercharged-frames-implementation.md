# Supercharged Sandbox Frames Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Widen iframe CSP to allow any HTTPS library, add PDF proxy endpoint, enhance code execution with rich output, and rewrite the system prompt for maximum LLM creative freedom.

**Architecture:** Single `SandboxFrame` component with `script-src https:` CSP. Security via iframe `sandbox` attribute (no same-origin). New `/api/mcp/fetch-pdf` proxy endpoint for PDF URLs. `buildCodeExecHtml` enhanced for rich visual output (matplotlib/plotly). System prompt rewritten to encourage free-form HTML generation.

**Tech Stack:** TypeScript, Express, React, Pyodide, pdf.js (CDN)

---

### Task 1: Widen CSP in SandboxFrame

**Files:**
- Modify: `packages/client/src/components/SandboxFrame.tsx:59-60`

**Step 1: Update the CSP meta tag**

Replace the current CSP string in `buildSrcDoc()` (line 60):

```typescript
// OLD:
content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://unpkg.com; img-src https: data: blob:; connect-src https: blob:; worker-src blob:;"

// NEW:
content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; connect-src https: blob: data:; worker-src blob:; media-src https: blob: data:;"
```

**Step 2: Update the comment block**

Update the JSDoc comment at line 14-17 to reflect the new security model:

```typescript
/**
 * Renders an agent-generated UI component inside a sandboxed iframe.
 *
 * Security properties:
 * - sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" (no same-origin, no forms)
 * - CSP allows any HTTPS CDN for scripts/styles (maximum LLM freedom)
 * - Security boundary is the sandbox attribute, not CSP
 * - Only escape hatch is postMessage to parent
 */
```

**Step 3: Verify the client builds**

Run: `npm -w packages/client run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add packages/client/src/components/SandboxFrame.tsx
git commit -m "feat: widen iframe CSP to allow any HTTPS CDN"
```

---

### Task 2: Add PDF proxy endpoint

**Files:**
- Create: `packages/proxy/src/routes/fetchPdf.ts`
- Modify: `packages/proxy/src/server.ts:32-41`

**Step 1: Create the PDF fetch route**

Create `packages/proxy/src/routes/fetchPdf.ts`:

```typescript
import { Router } from 'express';

export const fetchPdfRouter = Router();

fetchPdfRouter.get('/fetch-pdf', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      res.status(400).json({ error: 'Only HTTP(S) URLs allowed' });
      return;
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AI-Interface/1.0)' },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `Upstream returned ${response.status}` });
      return;
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err: any) {
    res.status(502).json({ error: err.message || 'Failed to fetch PDF' });
  }
});
```

**Step 2: Register the route in server.ts**

Add import at line 6 area (after other route imports):

```typescript
import { fetchPdfRouter } from './routes/fetchPdf.js';
```

Add route registration after the filesRouter line (after line 41):

```typescript
// PDF proxy (protected, under MCP path)
app.use('/api/mcp', fetchPdfRouter);
```

**Step 3: Verify the proxy builds**

Run: `npm -w packages/proxy run build`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add packages/proxy/src/routes/fetchPdf.ts packages/proxy/src/server.ts
git commit -m "feat: add PDF proxy endpoint for iframe-safe PDF fetching"
```

---

### Task 3: Enhance buildCodeExecHtml for rich output

**Files:**
- Modify: `packages/proxy/src/agent/Agent.ts:201-262`

**Step 1: Update the Python code execution HTML**

Replace the entire Python section of `buildCodeExecHtml` (from `// Python via Pyodide` comment to end of function) with:

```typescript
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
```

**Step 2: Verify the proxy builds**

Run: `npm -w packages/proxy run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add packages/proxy/src/agent/Agent.ts
git commit -m "feat: enhance code execution with rich output and matplotlib SVG rendering"
```

---

### Task 4: Rewrite the system prompt

**Files:**
- Modify: `packages/proxy/src/agent/systemPrompt.ts`

**Step 1: Replace the entire system prompt**

Replace the full content of `systemPrompt.ts` with:

```typescript
export const SYSTEM_PROMPT = `You are a universal AI assistant that creates rich, interactive visual experiences. You have tools for web search, page fetching, code execution, file operations, and GIS/mapping.

ALWAYS use tools to get real data. Never fabricate results.

## Workflow
1. Analyze what the user needs
2. Call tools to gather data or perform actions
3. Call render_component to display results as interactive HTML

## render_component — Your Primary Output

You generate complete HTML/CSS/JS that runs inside a sandboxed iframe. You can load ANY library from ANY HTTPS CDN. You have maximum creative freedom.

Available CDNs (examples — any HTTPS source works):
- https://cdn.jsdelivr.net — Chart.js, Pyodide, Mermaid, Highlight.js
- https://unpkg.com — Leaflet, React, D3, Three.js
- https://cdnjs.cloudflare.com — pdf.js, Prism, Anime.js, Lodash
- https://esm.sh — ESM imports for any npm package

Common patterns:
- Maps → Leaflet (unpkg.com/leaflet@1.9.4)
- Charts → Chart.js (cdn.jsdelivr.net/npm/chart.js)
- 3D → Three.js (unpkg.com/three)
- Data tables → Custom sortable HTML table
- PDF viewer → pdf.js (cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.124/pdf.min.mjs)
- Diagrams → Mermaid (cdn.jsdelivr.net/npm/mermaid)
- Code highlighting → Prism or Highlight.js
- Interactive apps → Vanilla JS, or load React/Vue/Svelte from CDN

HTML rules:
- Self-contained. All CSS/JS inline except CDN libs.
- COMPONENT_ID is predefined as a global variable — do NOT redeclare it.
- Dark theme: #1a1a2e background, #e0e0e0 text, #111 for panels.
- Fill viewport: 100vw x 100vh. Scrollable content via overflow:auto.
- Links open in new tabs automatically (base target="_blank" is set).

## Web Pages — Reader View

When the user asks to view a web page, use fetch_page to get the content, then render it as a clean reader view via render_component:
- Clean article layout with good typography (16px body, 1.6 line-height)
- Title, byline, source URL at top
- No ads, no tracking, no clutter
- Images preserved, links clickable
- component_type: 'web_page'

## PDF Display

To display a PDF, use render_component with HTML that loads pdf.js:
- For URLs: fetch from /api/mcp/fetch-pdf?url=<encoded-url>
- For uploaded files: fetch from /api/files/<session_id>/<filename>
- Render pages to canvas with prev/next navigation
- component_type: 'pdf_viewer'

## execute_code — Python & JavaScript

Each call creates a visible window with the code and its output.
- Python runs in Pyodide (browser). Standard packages (pandas, numpy, matplotlib, scipy, scikit-learn) auto-load from imports.
- Matplotlib figures render as inline SVGs automatically.
- Write complete, correct code. Each call = one window.
- Combine related logic into one call.
- For pure visualizations, prefer render_component with Chart.js (faster, no Pyodide load time).

## Tool Summary
| Tool | Use For |
|------|---------|
| render_component | Display ANY visual: charts, maps, tables, apps, PDFs, articles |
| execute_code | Run Python/JS with visible output |
| web_search | Search the web (categories: general, news, images, science, files) |
| fetch_page | Fetch & extract readable content from a URL |
| geocode | Place name → lat/lon |
| search_pois | Find nearby points of interest |
| calculate_route | Route between two points |
| read_file / write_file | Read uploaded files / write downloadable files |
| show_notification | Toast notification |
| remove_component | Remove a UI tile |

Reply with a brief plain-text summary. No markdown, no JSON in your reply text.`;
```

**Step 2: Verify the proxy builds**

Run: `npm -w packages/proxy run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add packages/proxy/src/agent/systemPrompt.ts
git commit -m "feat: rewrite system prompt for maximum creative freedom"
```

---

### Task 5: Build, deploy, and verify

**Step 1: Run all tests**

```bash
npm run test
```

Expected: All existing tests pass.

**Step 2: Rebuild and deploy all containers**

```bash
docker compose up -d --build --force-recreate proxy client
```

Expected: Both services build successfully and start.

**Step 3: Verify health**

```bash
curl http://localhost:8080/api/health
```

Expected: `{"status":"ok"}`

**Step 4: Test PDF proxy endpoint**

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/mcp/fetch-pdf?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" -H "X-Session-Token: test"
```

Expected: Should return a response (401 if session validation blocks it, which confirms the route is registered).

**Step 5: Commit all together if not already committed per-task**

```bash
git add -A
git commit -m "feat: supercharged sandbox frames — wide CSP, PDF proxy, rich code output, new system prompt"
```
