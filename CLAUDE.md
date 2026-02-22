# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A universal AI assistant that generates its own UI at runtime. The LLM produces complete HTML/CSS/JS components rendered in sandboxed iframes, using any library from any HTTPS CDN. Features a desktop-like floating window manager (drag, resize, minimize, maximize, z-order). Includes web search (SearXNG), page fetching with auto reader view, Python execution (Pyodide with matplotlib SVG rendering), PDF display, GIS/mapping, and file uploads.

## Architecture

- **packages/client/** — React SPA. Floating window manager (`WorkspaceCanvas.tsx`), sandboxed iframe rendering (`SandboxFrame.tsx` with import map for bare ESM imports), postMessage intent validation (`IntentRouter.ts`), contextual chat suggestions (`ChatPanel.tsx`). File upload support.
- **packages/proxy/** — Node.js/Express orchestration proxy. LLM agent loop (`Agent.ts`) with auto-rendering for `fetch_page` (reader view) and `execute_code` (code + output + matplotlib SVGs). Configurable LLM provider (OpenAI-compatible or Anthropic). HMAC session tokens, HTTP Message Signatures, rate limiting. PDF proxy endpoint.
- **packages/shared/** — Shared TypeScript types and crypto utilities.
- **Docker Compose** — 4 services: client (nginx), proxy (Node.js), searxng, redis (valkey). Only port 8080 exposed.

## Development

```bash
npm install                    # Install all workspaces
npm run dev                    # Start proxy + client concurrently
npm run test                   # Run all tests
npm run dev:proxy              # Proxy only (port 3001)
npm run dev:client             # Client only (port 5173)
```

Single test file: `npx -w packages/proxy vitest run src/crypto/sessionToken.test.ts`

### Docker (production)

```bash
cp .env.example .env           # Configure LLM provider
docker compose up -d --build   # Build and start all services
# Open http://localhost:8080
```

Rebuild after code changes: `docker compose up -d --build --force-recreate proxy client`

### Environment Variables

Requires `.env` (copy from `.env.example`):
- `LLM_PROVIDER` — `openai` (Ollama/OpenAI-compatible) or `anthropic`
- `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` — for OpenAI-compatible providers
- `ANTHROPIC_API_KEY` — when using Anthropic
- `HMAC_SECRET` — session signing key
- `SEARXNG_URL` — SearXNG instance for `web_search` tool (default: `http://localhost:8080`, Docker overrides to `http://searxng:8080`)
- `SESSION_FILE_DIR` — directory for per-session uploaded/generated files
- `CORS_ORIGIN` — CORS origin (default: `http://localhost:5173`, Docker sets `http://localhost:8080`)

## Key Concepts

### Generative UI
The LLM generates complete HTML/JS UI components via `render_component`. No predefined templates — the LLM decides both the data AND the visual representation. An import map in `SandboxFrame.tsx` resolves bare ESM imports (`three`, `d3`, `chart.js/auto`, `mermaid`) to `esm.sh` CDN URLs automatically.

### Auto-Rendering Tools
Two tools auto-create UI windows server-side (the LLM doesn't need to call `render_component`):
- **`fetch_page`** — auto-renders a clean reader view (Readability-extracted, sanitized HTML). LLM receives only a short summary.
- **`execute_code`** — auto-renders code + output window. Python: Pyodide with `loadPackagesFromImports()`, matplotlib SVG extraction, `plt.show()` suppressed. JS: direct eval. Failed windows auto-remove via `code_exec_error` postMessage.

### Agent Tools
| Tool | Description |
|------|-------------|
| `render_component` | Render any HTML/JS/CSS in a sandboxed iframe window |
| `execute_code` | Run Python (Pyodide) or JavaScript with visible output (auto-renders) |
| `web_search` | Search the web via SearXNG (Brave, Bing, Mojeek, Wikipedia, etc.) |
| `fetch_page` | Fetch a URL, extract readable content, auto-render reader view |
| `geocode` | Resolve place names to lat/lon (Nominatim) |
| `search_pois` | Find points of interest (Overpass API) |
| `calculate_route` | Route between two points (Valhalla) |
| `read_file` / `write_file` | Read uploaded files / write downloadable files |
| `show_notification` | Show toast notification |
| `remove_component` | Remove a UI window |

### Floating Window Manager
`WorkspaceCanvas.tsx` — custom floating WM (no library dependency). Features: drag (title bar), resize (8 edge handles), z-index stacking, cascade placement, minimize (taskbar), maximize (toggle), close. Iframe click-to-focus via `window.blur` detection (`data-window-id` attribute).

### Security Model
Security boundary is the iframe `sandbox` attribute, not CSP:
1. **Iframe sandbox** — `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"`. No same-origin, no parent DOM access.
2. **Wide CSP** — `script-src 'unsafe-inline' 'unsafe-eval' https:` allows any HTTPS CDN within the sandbox.
3. **Session tokens** — HMAC-SHA256 signed, self-validating (no DB lookup).
4. **HTTP Message Signatures** — RFC 9421 subset. Every request signed with content digest.
5. **Intent validation** — postMessage from iframes: origin check, source check, schema validation, rate limiting (10/sec).

### No Database
All state is ephemeral: client React state, LLM conversation memory (in-process Map, last 6 messages), proxy rate-limit counters (in-process Map with TTL eviction).

## Key Files

| Area | File |
|------|------|
| Floating window manager | `packages/client/src/components/WorkspaceCanvas.tsx` |
| Iframe sandbox + CSP + import map | `packages/client/src/components/SandboxFrame.tsx` |
| Contextual chat suggestions | `packages/client/src/components/ChatPanel.tsx` |
| Auto-remove errored windows | `packages/client/src/App.tsx` (message listener) |
| LLM agent loop + auto-rendering | `packages/proxy/src/agent/Agent.ts` |
| System prompt (LLM capabilities) | `packages/proxy/src/agent/systemPrompt.ts` |
| Tool definitions | `packages/proxy/src/agent/toolRegistry.ts` |
| LLM provider abstraction | `packages/proxy/src/agent/llmProvider.ts` |
| Web search (SearXNG) | `packages/proxy/src/tools/webSearch.ts` |
| Page fetching (Readability) | `packages/proxy/src/tools/fetchPage.ts` |
| PDF proxy endpoint | `packages/proxy/src/routes/fetchPdf.ts` |
| HMAC session tokens | `packages/proxy/src/crypto/sessionToken.ts` |
| HTTP Message Signatures | `packages/proxy/src/crypto/httpSignatures.ts` |
| postMessage intent validation | `packages/client/src/core/IntentRouter.ts` |
| SearXNG engine config | `searxng/settings.yml` |
| Docker Compose stack | `docker-compose.yml` |
| nginx reverse proxy | `nginx.conf` |
