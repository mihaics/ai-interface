# Agent-Driven Backend-Less UI via Model Context Protocol

## Design Document

**Date:** 2026-02-22
**Status:** Approved
**Domain:** GIS/Maps demonstration

---

## 1. Problem Statement

Build a working implementation that demonstrates the patent-claimed architecture: an agent-driven, backend-less user interface where an LLM generates actual UI components (HTML/JS) at runtime, rendered in cryptographically sandboxed iframes, communicating via validated postMessage intents, with all session state ephemeral and self-validating (no database).

This architecture must substantiate the following patent claims that are NOT present in the existing GEEA-AI codebase:
- Dynamic UI generation by the LLM (not predefined component invocation)
- Iframe sandboxing with Content Security Policy
- Cryptographic session tokens (HMAC-SHA256, self-validating)
- HTTP Message Signatures (RFC 9421) on MCP payloads
- postMessage intent validation with origin checks, schema enforcement, and HMAC verification
- Ephemeral session state with no persistent backend

---

## 2. Architecture

### 2.1 System Overview

```
BROWSER (React SPA - MCP Host)
├── Chat Panel: user input + agent messages
├── Workspace Canvas: grid of sandboxed iframes
├── Intent Router: validates postMessage from sandboxes
├── Sandbox Registry: tracks active iframes + intent schemas
└── Session Manager: HMAC token lifecycle
        │
        │ HTTPS (Streamable HTTP / MCP protocol)
        ▼
ORCHESTRATION PROXY (Node.js - stateless)
├── Session Manager: issue + validate HMAC tokens
├── MCP Router: routes to LLM + external tools
├── Signature Engine: HTTP Message Signatures (RFC 9421)
├── LLM API (Claude): tool calling + UI generation
├── Data Tools: geocoding, POI search, routing
└── UI Tools: render_component, update, remove
```

### 2.2 Key Principles

1. **The proxy is a security primitive** - holds secrets (API keys), signs/validates tokens, routes MCP messages. Zero business logic, zero database, zero UI decisions.
2. **The LLM is the orchestrator** - receives user intent, fetches data via MCP tools, generates UI components (HTML/JS payloads).
3. **The browser is the MCP Host** - renders agent-generated UI in sandboxed iframes, validates postMessage intents, manages ephemeral session state.
4. **No database** - all state lives in the session token (HMAC-signed) + client-side context window + LLM memory.

---

## 3. MCP Protocol Layer & Generative UI

### 3.1 Two Output Modes

**Mode 1: Tool Calls (structured operations)**
LLM calls MCP tools that return structured data:
```
geocode("Amsterdam") → {lat: 52.37, lon: 4.89}
search_pois("cafe", 52.37, 4.89) → [{name, lat, lon}, ...]
```

**Mode 2: Generative UI (patent claim)**
LLM generates a self-contained HTML/JS UI component returned as an MCP embedded resource:
```json
{
  "type": "embedded_resource",
  "resource": {
    "uri": "ui://session-abc/component-xyz",
    "mimeType": "text/html",
    "text": "<div id='root'>...</div><script>/* interactive UI */</script>"
  },
  "metadata": {
    "component_type": "map_view",
    "sandbox_permissions": ["allow-scripts"],
    "intent_schema": {
      "marker_click": {"lat": "number", "lon": "number", "id": "string"},
      "viewport_change": {"bounds": "object"}
    }
  }
}
```

### 3.2 Intent Protocol (postMessage format)

**Iframe to host:**
```json
{
  "type": "ui_intent",
  "session_token": "hmac-signed-token",
  "component_id": "component-xyz",
  "intent": "marker_click",
  "payload": {"lat": 52.37, "lon": 4.89, "id": "cafe-1"},
  "timestamp": 1708617600000,
  "signature": "hmac-sha256-of-payload"
}
```

**Host to iframe:**
```json
{
  "type": "ui_update",
  "component_id": "component-xyz",
  "action": "highlight_marker",
  "payload": {"id": "cafe-1", "color": "#ff0000"},
  "signature": "hmac-sha256-of-payload"
}
```

### 3.3 MCP Tools

**Data tools:**
- `geocode` - resolve place names to coordinates (Nominatim)
- `search_pois` - find points of interest (Overpass API)
- `calculate_route` - routing (Valhalla)
- `web_search` - real-time info

**UI tools:**
- `render_component` - render agent-generated HTML/JS in a new sandbox
- `update_component` - send data to an existing sandbox
- `remove_component` - destroy a sandbox
- `show_notification` - toast message in host
- `request_user_input` - blocking form dialog in host

---

## 4. Security Architecture

### 4.1 Layer 1: Iframe Sandboxing

```html
<iframe
  sandbox="allow-scripts"
  srcdoc="...agent-generated HTML/JS..."
  csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
       img-src https: data:; connect-src 'none'"
></iframe>
```

Prevents: parent DOM access, network requests, form submission, popups, navigation.
Allows: inline script execution, inline styles, images, postMessage to parent.

### 4.2 Layer 2: Cryptographic Session Tokens (HMAC-SHA256)

```
payload = base64url({sid, iat, exp, fpr: sha256(userAgent + ip)})
token = payload + "." + hmac_sha256(payload, SERVER_SECRET)
```

Self-validating: no database lookup. Validates HMAC, expiry, and fingerprint.

### 4.3 Layer 3: HTTP Message Signatures (RFC 9421)

Every MCP message carries:
```http
Signature-Input: sig1=("@method" "@path" "content-type" "content-digest");
    created=1708617600;keyid="session-abc";alg="hmac-sha256"
Content-Digest: sha-256=:base64-hash:
Signature: sig1=:base64-hmac-of-signature-base:
```

### 4.4 Layer 4: postMessage Validation (Intent Router)

Validates every incoming postMessage:
1. Origin check (must be 'null' for srcDoc iframes)
2. Source check (must be a registered sandbox iframe)
3. Schema validation (payload matches declared intent_schema)
4. Signature check (HMAC of payload)
5. Rate limiting (max N intents per second per sandbox)

---

## 5. State Management

### 5.1 Ephemeral Session State

**Client-side (React state):**
- Session token, active components map, conversation history, viewport state

**Agent context window (LLM memory):**
- Session ID, active components list, viewport, conversation summary, last intent

**Proxy session cache (in-memory, TTL-bound):**
- Rate limiting counters, last activity timestamp. Auto-evicted. No persistence.

### 5.2 MDP Formalization

- **State S(t)** = {active_components, viewport, conversation_history, last_intent}
- **Action A(t)** = LLM response (tool calls + generated UI)
- **Transition** = deterministic given the agent's action (MCP protocol enforces structure)
- Session token encodes S(t) - no external state lookup required

---

## 6. Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | React 19 + TypeScript + Vite |
| Map (in sandboxes) | Leaflet via CDN in srcDoc |
| Charts (in sandboxes) | Chart.js via CDN in srcDoc |
| Proxy | Node.js + Express |
| MCP SDK | @modelcontextprotocol/sdk (TypeScript) |
| LLM | Anthropic SDK (Claude) |
| Crypto | Node.js crypto (HMAC-SHA256) |
| HTTP Signatures | Custom RFC 9421 subset |
| Geocoding | Nominatim API |
| POI search | Overpass API |
| Routing | Valhalla (FOSSGIS public) |

---

## 7. Project Structure

```
ai-interface/
├── packages/
│   ├── client/          # React SPA (MCP Host)
│   │   ├── src/
│   │   │   ├── components/     # ChatPanel, WorkspaceCanvas, SandboxFrame
│   │   │   ├── core/           # IntentRouter, SandboxRegistry, SessionManager, McpClient
│   │   │   ├── crypto/         # HMAC, HTTP signatures (client-side)
│   │   │   └── types/          # Intent, session, MCP types
│   │   └── vite.config.ts
│   │
│   ├── proxy/           # Orchestration Proxy (Node.js)
│   │   ├── src/
│   │   │   ├── routes/         # MCP endpoint, session endpoint
│   │   │   ├── middleware/     # Session validation, signature verification, rate limiting
│   │   │   ├── agent/          # GisAgent, tool registry, system prompt
│   │   │   ├── tools/          # Geocoding, POI search, routing, UI tools
│   │   │   └── crypto/         # Session tokens, HTTP signatures, intent signing
│   │   └── package.json
│   │
│   └── shared/          # Shared types and crypto utilities
│       └── src/
│           ├── types/          # MCP messages, intent protocol, session types
│           └── crypto/         # Isomorphic HMAC
│
├── docs/plans/
└── .env.example
```
