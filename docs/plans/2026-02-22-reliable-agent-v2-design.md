# Reliable Agent v2 — Design Document

**Date:** 2026-02-22
**Goal:** Make the AI assistant produce dramatically more consistent visual output, make reliable tool choices, handle errors gracefully, and support richer use cases (data analysis, multi-step research, interactive apps).

## Problem Statement

The current system has four pain points:
1. **Visual quality varies** — LLM sometimes produces polished dark-theme UI, other times unstyled/broken layouts
2. **Tool choice is unreliable** — LLM doesn't always pick the right tool for the task
3. **Responses are unpredictable** — same request type gives different quality each time
4. **Error handling is weak** — failures are silent, no recovery path

## Design

### 1. CSS Design System (Refined Dark)

Pre-defined CSS custom properties injected into every iframe sandbox. The LLM is instructed to use these exclusively.

```css
:root {
  /* Backgrounds (3 levels) */
  --bg-base: #0a0a1a;
  --bg-surface: #141428;
  --bg-elevated: #1e1e3a;

  /* Text (3 levels) */
  --text-primary: #e8e8f0;
  --text-secondary: #9898b0;
  --text-muted: #585870;

  /* Accents */
  --accent: #3b82f6;
  --accent-hover: #60a5fa;

  /* States */
  --success: #4ade80;
  --warning: #fbbf24;
  --error: #f87171;

  /* UI */
  --border: rgba(255, 255, 255, 0.08);
  --radius: 8px;
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.5);

  /* Spacing scale */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 1rem;
  --space-4: 1.5rem;
  --space-5: 2rem;
  --space-6: 3rem;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}
```

This CSS is injected into `SandboxFrame.tsx`'s `buildSrcDoc` function alongside utility classes for common patterns (`.card`, `.grid`, `.table`).

### 2. System Prompt Overhaul

The system prompt (`systemPrompt.ts`) is rewritten with:

**Tool Decision Trees:**

| User Intent | Tool Chain |
|---|---|
| Analyze data / CSV | `read_file` → `execute_code` (Python) → `render_component` (viz) |
| Open / show URL | `fetch_page` only (auto-renders; do NOT also render) |
| Search / find / latest | `web_search` → optionally `fetch_page` → `render_component` (summary) |
| Calculate / algorithm | `execute_code` |
| Map / directions / nearby | `geocode` → `search_pois` / `calculate_route` → `render_component` (Leaflet) |
| Build interactive thing | `render_component` directly |
| Compare X vs Y | `web_search` both → `fetch_page` → `render_component` (comparison) |

**Component Skeletons** (compact patterns):

- **Dashboard**: CSS Grid `auto-fit, minmax(280px, 1fr)`, stat cards
- **Data Table**: Full-width, sortable, alternating rows, overflow-x scroll
- **Chart**: Chart.js with dark theme config, responsive container
- **Search Results**: Vertical card stack with title/snippet/link
- **Interactive App**: Nav + scrollable main + fixed footer

**Quality Rules (mandatory for every render_component):**

1. Use CSS variables, never hardcoded colors
2. Fill `100vw x 100vh` with Grid or Flexbox
3. Loading states for async operations
4. Error states with user-friendly messages
5. Interactive elements get `cursor: pointer` + hover transitions
6. Responsive — use `auto-fit`/`minmax`, no fixed widths
7. `COMPONENT_ID` is predefined — do NOT redeclare

**Multi-step Workflow Patterns:**

- Research: search → read top 3-5 → synthesize → present dashboard
- Data analysis: read file → Python aggregations → chart + table side by side
- Comparison: fetch multiple pages → extract key points → comparison matrix

### 3. Agent Loop Improvements (Agent.ts)

**Parallel Tool Execution:**
- Execute independent tool calls with `Promise.all` instead of sequential `for` loop
- Only serialize dependent calls (e.g., `geocode` then `search_pois` using the result)

**Structured Error Feedback:**
- `fetch_page` 403/404 → "Page fetch failed (403). Site blocks automated access. Try a different source."
- `web_search` empty → "No results. Try broader terms or different category."
- `execute_code` error → Include line number and error type
- This enables the LLM to self-correct in the next agent loop iteration

**Richer Memory:**
- Increase from 6-message sliding window
- Include session context: uploaded files, active components, discussed topics
- Allows multi-step workflows to maintain coherence

**New Tool: `list_session_files`**
- Returns array of `{ filename, size, uploaded_at }` for the current session
- Critical for "upload → analyze" workflows where the LLM needs to discover files

**New Tool: `update_component`**
- Parameters: `component_id`, `action`, `payload`
- Sends a `ui_update` postMessage to the target iframe
- Components can listen for updates and re-render data without full iframe reload
- Prevents the flicker of destroy-and-recreate

### 4. Sandbox Frame Improvements (SandboxFrame.tsx)

**Pre-injected Design System:**
- `buildSrcDoc` injects full CSS variables + base styles + utility classes
- Even poorly-styled LLM output inherits the theme
- Base styles include: body background, text color, scrollbar styling, link colors

**Error Boundary:**
- `window.onerror` handler captures runtime errors
- `window.onunhandledrejection` captures promise rejections
- Both send structured error via `postMessage({ type: 'component_error', component_id, error, stack })`
- Client can display toast and/or feed error back to agent

**Default Loading State:**
- Inject a CSS spinner animation that shows by default
- Component's own content hides the spinner when it renders
- Prevents blank white flash during CDN script loading

### 5. Tool Registry Improvements (toolRegistry.ts)

Better tool descriptions with usage guidance:
- `render_component`: "Render interactive HTML/JS/CSS. Use CSS variables from the design system. Import map available: three, chart.js/auto, d3, mermaid, marked."
- `execute_code`: "Run Python (Pyodide) or JavaScript. Use for calculations, data processing, algorithms. Output appears in a code window."
- `web_search`: "Search the web. Use `general` for broad queries, `news` for current events, `science` for academic content."
- `fetch_page`: "Fetch and display a web page in reader view. Do NOT also call render_component — the page is auto-rendered."

## Out of Scope

- Server-side component template library
- Component state persistence across messages
- Output HTML validation/linting
- Workflow planning/orchestration layer
- Provider-specific prompt tuning

## Files Changed

| File | Change |
|---|---|
| `packages/proxy/src/agent/systemPrompt.ts` | Complete rewrite with design system, decision trees, quality rules |
| `packages/proxy/src/agent/Agent.ts` | Parallel tool exec, structured errors, richer memory, new tool handlers |
| `packages/proxy/src/agent/toolRegistry.ts` | Better descriptions, new tool definitions |
| `packages/client/src/components/SandboxFrame.tsx` | Inject design system CSS, error boundary, loading state |
| `packages/client/src/App.tsx` | Handle `component_error` postMessage type |
| `packages/proxy/src/tools/fileOps.ts` | Add `listSessionFiles` function |
| `packages/client/src/core/IntentRouter.ts` | Add `component_error` + `ui_update` intent types |
