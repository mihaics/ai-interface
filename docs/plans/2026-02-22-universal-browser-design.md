# Universal Agent-Driven Browser

## Design Document

**Date:** 2026-02-22
**Status:** Approved
**Evolves from:** GIS/Maps demonstration → Universal information browser

---

## 1. Problem Statement

Transform the GIS-only agent-driven UI into a universal browser where the user chats with an AI agent that can search the web, fetch pages, execute code, handle files, and display results in appropriate visual containers — maps, tables, charts, web pages, code notebooks, markdown — arranged in a tiling window manager.

The existing architecture (sandboxed iframes, intent routing, HMAC session tokens, LLM provider abstraction, agentic tool loop) is already generic. This design extends the tool set, generalizes the prompt, and upgrades the layout.

---

## 2. Approach

**Evolutionary extension** of the current architecture. No rewrite. Add tools, swap the layout, update the prompt. The sandbox security model, intent routing, token crypto, and agentic loop stay unchanged.

---

## 3. New Tools

Five new tools added alongside the existing 3 GIS tools + 3 UI control tools:

| Tool | Purpose | Runs on |
|------|---------|---------|
| `web_search` | Query SearXNG, return structured results (title, url, snippet) | Proxy |
| `fetch_page` | Fetch URL, extract readable content via @mozilla/readability | Proxy |
| `execute_code` | Run JS or Python. Returns stdout, stderr, result | In-browser (Pyodide in iframe) |
| `read_file` | Read a user-uploaded file from session temp dir | Proxy |
| `write_file` | Write/generate a file, make it downloadable | Proxy |

### 3.1 Web Search

- Proxy sends HTTP request to SearXNG instance (URL from `SEARXNG_URL` env var)
- Query params: `q`, `format=json`, `categories` (general, news, images, science, files)
- Returns: array of `{title, url, snippet, engine}` — top 10 results

### 3.2 Page Fetching

- Proxy fetches URL with reasonable User-Agent, 10s timeout, 5MB max body
- HTML parsed with `@mozilla/readability` (same as Firefox Reader View)
- Returns: `{title, content (clean HTML), text_content (plain text), excerpt, byline, length}`
- Non-HTML (JSON, CSV, plain text): returns raw content with detected mime type

### 3.3 Code Execution

**Phase 1 (this design): In-browser only**
- Pyodide (Python in WebAssembly) loaded on demand inside a sandboxed iframe
- Agent calls `execute_code` with code string → proxy returns code as-is → client renders in iframe that loads Pyodide and runs it
- Covers: calculations, data transforms, plots (numpy, pandas, matplotlib included in Pyodide)

**Phase 2 (future): Server-side Docker**
- `/api/exec` endpoint running code in Docker container with timeout (30s), memory limit (256MB), no network
- Full Python with pip, Node.js, file access to session temp dir
- Not in scope for this implementation

### 3.4 File I/O

- Session temp directory: `{SESSION_FILE_DIR}/{session_id}/`
- `read_file`: reads from session dir, returns content + mime type
- `write_file`: writes to session dir, returns download URL (`/api/files/{session_id}/{filename}`)
- New `/api/upload` endpoint for user file uploads (multipart, via `multer`)
- New `/api/files/:sessionId/:filename` endpoint for downloads
- Temp dirs auto-cleaned after session expiry (2h TTL)

---

## 4. Component Types

The agent generates self-contained HTML via `render_component`. The `component_type` label tells the user what they're looking at:

| Type | Use case | CDN libs |
|------|----------|----------|
| `map_view` | Location data | Leaflet 1.9.4 |
| `data_table` | Structured data, search results | None (inline HTML/JS) |
| `chart` | Numeric data visualization | Chart.js |
| `web_page` | Fetched page content | None |
| `code_output` | Code + execution result | Pyodide (when executing) |
| `markdown` | Long-form text, analysis | None (inline renderer) |
| `image` | Image display | None |
| `download` | File download link | None |

No new rendering infrastructure — `SandboxFrame` already renders any HTML in a sandboxed iframe.

---

## 5. System Prompt

```
You are a universal AI assistant with access to tools for web search,
page fetching, code execution, file operations, and GIS/mapping.

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

Reply with a brief plain-text summary. No markdown, no JSON.
```

---

## 6. Tiling Window Manager

Replace vertical scroll layout with `react-grid-layout`.

### Behavior
- Each new component gets a tile, auto-placed below existing tiles
- Default tile size: full width (12 columns), 6 grid rows (~400px)
- Drag to rearrange, resize by dragging edges
- Header bar per tile: component type label, component ID, close (x) button
- "Clear All" button in status bar
- Tiles compact upward when one is closed
- Single column on narrow, up to 2 columns on wide screens

### Chat Panel
- Stays fixed at 360px on the right
- Updated copy: universal suggestions, not GIS-specific
- Upload button added to input area for file uploads

---

## 7. File Changes

### Proxy — new files
- `tools/webSearch.ts` — SearXNG client
- `tools/fetchPage.ts` — URL fetch + readability extraction
- `tools/codeExec.ts` — browser-mode passthrough (returns code for client)
- `tools/fileOps.ts` — read/write session temp dir
- `routes/upload.ts` — file upload endpoint (multer)
- `routes/files.ts` — file download endpoint

### Proxy — modified
- `agent/toolRegistry.ts` — add 5 new tool definitions
- `agent/systemPrompt.ts` — universal prompt
- `agent/GisAgent.ts` → rename to `agent/Agent.ts` — add new tool dispatch
- `server.ts` — mount upload/files routes

### Client — modified
- `components/WorkspaceCanvas.tsx` — `react-grid-layout` tiling
- `components/ChatPanel.tsx` — universal copy, upload button
- `App.tsx` — remove GIS-specific language

### Shared — modified
- `types/mcp.ts` — add file types to AgentContext

### New dependencies
- `react-grid-layout` + `@types/react-grid-layout` (client)
- `@mozilla/readability` + `jsdom` (proxy)
- `multer` + `@types/multer` (proxy)

### New env vars
- `SEARXNG_URL=http://localhost:8080`
- `SESSION_FILE_DIR=/tmp/ai-interface-sessions`

### Unchanged
- Session crypto (HMAC tokens, HTTP signatures)
- Intent router + sandbox registry
- SandboxFrame.tsx
- LLM provider abstraction
- All 4 security layers
