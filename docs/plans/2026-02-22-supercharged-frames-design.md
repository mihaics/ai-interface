# Supercharged Sandbox Frames Design

## Goal

Transform the iframe sandbox system from a constrained, predefined-type model into a maximum-capability rendering engine. The LLM can generate any HTML/CSS/JS, display PDFs, render clean web pages, and execute code with rich visual output — all inside secure sandboxed iframes.

## Architecture

One universal `SandboxFrame` component with a wide-open CSP (`script-src https:`). Security relies on the iframe `sandbox` attribute (no same-origin, no parent DOM access), not on CSP restrictions. The LLM has full creative freedom to build interactive apps, dashboards, games, visualizations — anything expressible as HTML/JS.

## Changes

### 1. Expanded CSP (SandboxFrame.tsx)

Replace the current restrictive CSP with:

```
default-src 'none';
script-src 'unsafe-inline' 'unsafe-eval' https:;
style-src 'unsafe-inline' https:;
font-src https: data:;
img-src https: data: blob:;
connect-src https: blob: data:;
worker-src blob:;
media-src https: blob: data:;
```

This allows loading any library from any HTTPS CDN (cdnjs, unpkg, jsdelivr, esm.sh, Google Fonts, etc.). The iframe sandbox attribute (`allow-scripts allow-popups allow-popups-to-escape-sandbox`) remains the hard security boundary — no `allow-same-origin`.

### 2. Clean Web Page Viewer

When the LLM calls `fetch_page`, it receives Readability-extracted content (already implemented). The system prompt is updated to guide the LLM to render this as a reader-view component: clean typography, dark theme, article layout, source link at top, via `render_component` with `component_type: 'web_page'`.

No new backend code needed — just system prompt guidance.

### 3. PDF Viewer

**New proxy endpoint:** `GET /api/mcp/fetch-pdf?url=<encoded-url>` fetches a PDF server-side and returns binary content. Required because iframes can't fetch cross-origin resources directly without `allow-same-origin`.

**From uploads:** Uploaded files already served at `GET /api/mcp/files/:sessionId/:filename`.

**Rendering:** The LLM generates an HTML component that loads pdf.js from CDN (`cdnjs.cloudflare.com/ajax/libs/pdf.js/`) and renders pages to canvas elements with navigation controls. The system prompt includes a pdf.js usage pattern.

### 4. Enhanced Code Execution (Agent.ts)

Update `buildCodeExecHtml`:

- Support rich HTML output (innerHTML) alongside text output for matplotlib/plotly charts rendered as inline SVG/PNG
- Show "Installing packages..." during `loadPackagesFromImports()`
- Support multiple output types (text + visual) in the same window

### 5. System Prompt Overhaul (systemPrompt.ts)

Remove the rigid component type list. Replace with:

- Emphasis on freedom: any HTML/CSS/JS, any HTTPS CDN library
- Specific patterns for common use cases (maps, charts, tables, PDF, web pages, interactive apps)
- Guidance for `fetch_page` → render as clean readable article
- Guidance for PDF display via pdf.js
- Encourage rich, interactive components over plain text

### 6. File-by-File Changes

| File | Change |
|------|--------|
| `SandboxFrame.tsx` | Widen CSP to `script-src https:`, add `media-src`, `font-src` |
| `Agent.ts` | Update `buildCodeExecHtml` for rich output, progress messages |
| `systemPrompt.ts` | Rewrite for maximum freedom, add PDF/web-page/code patterns |
| `server.ts` | Add `GET /api/mcp/fetch-pdf` proxy endpoint |
| `toolRegistry.ts` | No changes needed |

## Security Model

The security boundary is the iframe `sandbox` attribute, not CSP:

- `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"` — no same-origin, no parent DOM, no forms, no top-level navigation
- postMessage intent validation (IntentRouter) with schema checking and rate limiting
- CSP is permissive within the sandbox — the LLM can load any HTTPS resource but cannot escape the iframe
