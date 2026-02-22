# Defensive Publication: Agent-Driven Backend-Less User Interface via Model Context Protocol

**Publication Date:** 2026-02-22
**Authors:** Mihai Csaky, SysOP Consulting
**License:** Apache License 2.0 (with explicit patent grant — see LICENSE)
**Repository:** https://github.com/mihaics/ai-interface

---

## Abstract

This document constitutes a defensive publication and enabling technical disclosure of a novel software architecture for **probabilistic user interface generation** by a **large language model (LLM) agent** operating within the **Model Context Protocol (MCP)** framework, where the agent dynamically generates complete, self-contained HTML and JavaScript user interface components at runtime, which are rendered inside **cryptographically sandboxed execution partitions** (browser iframes with Content Security Policy enforcement), communicating with the host application exclusively through a **validated semantic intent routing protocol** (postMessage), with all session state maintained ephemerally through **self-validating cryptographic session tokens** (HMAC-SHA256) requiring **no persistent backend database**, and all inter-component messages authenticated via **HTTP Message Signatures** conforming to a subset of RFC 9421.

This architecture eliminates the traditional backend application server and database tier from interactive web applications by delegating all business logic orchestration to the LLM agent, all state persistence to cryptographically signed ephemeral tokens, and all UI rendering to dynamically generated sandboxed components.

---

## 1. Objective Technical Problem

### 1.1 Problem Statement

Contemporary web application architectures require a persistent backend application server and database to manage session state, enforce authorization, serve pre-built UI templates, and coordinate data flow between frontend components. This architecture introduces several well-documented technical problems:

1. **Backend database latency and operational burden**: Every user interaction that requires state lookup must round-trip to a centralized database, introducing latency proportional to network distance and query complexity. The database itself requires provisioning, scaling, backup, and schema migration infrastructure.

2. **Cross-site scripting (XSS) vulnerability surface**: Traditional single-page applications render dynamic content directly into the host document's DOM, where a single unsanitized string can achieve arbitrary code execution with full access to cookies, localStorage, and the parent page's JavaScript context.

3. **Rigid, template-bound user interfaces**: Pre-built UI component libraries restrict the application to a fixed set of visual representations. Adding a new visualization type (e.g., a specialized map overlay or a novel chart type) requires a developer to write, test, and deploy new frontend code.

4. **Monolithic state coupling**: Server-side session stores create a single point of failure. If the session database becomes unavailable, all active users lose their sessions simultaneously.

### 1.2 Technical Solution

This disclosure describes a **deterministic state synchronization architecture** in which:

- A **stateless orchestration proxy** holds no business logic and no persistent state. It functions exclusively as a **cryptographic security primitive**: issuing self-validating HMAC-SHA256 session tokens, verifying HTTP Message Signatures on every MCP payload, and proxying requests between the browser client and the LLM API.

- A **large language model agent** (the "orchestrator") receives user queries via the Model Context Protocol, fetches structured data from external tool APIs (geocoding, point-of-interest search, routing), and generates complete, self-contained HTML/JavaScript user interface components as **MCP embedded resources**. The LLM decides both the data to fetch AND the visual representation to generate, constituting **probabilistic UI generation** — the UI is not selected from a predefined template library but is synthesized de novo by the model for each interaction.

- A **browser-based MCP Host** (React single-page application) renders each agent-generated UI component inside a **cryptographically sandboxed execution partition**: an `<iframe>` element with `sandbox="allow-scripts"` and an embedded Content Security Policy meta tag that blocks all network access (`connect-src 'none'`), prevents parent DOM traversal, and restricts resource loading to specific CDN origins. Each sandboxed component communicates with the host exclusively through a **semantic intent routing protocol** over `window.postMessage`, where every message is validated against a declared schema, checked for origin authenticity, and rate-limited.

- **All session state is ephemeral and self-validating.** The session token is a base64url-encoded JSON payload containing a session ID, issuance timestamp, expiry timestamp, and a client fingerprint (SHA-256 of User-Agent concatenated with IP address), signed with HMAC-SHA256 using a server-side secret. Token validation requires only the secret key and the token itself — no database lookup. Conversation history is maintained in an in-process Map on the proxy (evicted by TTL) and in the LLM's context window. Client-side React state holds the active component list and viewport. No data survives a process restart.

---

## 2. System Architecture

### 2.1 Component Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (MCP Host)                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────────────────────────────────────┐ │
│  │  Chat Panel   │  │          Workspace Canvas                    │ │
│  │              │  │  ┌────────────┐  ┌────────────┐              │ │
│  │  User Input  │  │  │  Sandbox   │  │  Sandbox   │              │ │
│  │  Agent Msgs  │  │  │  (iframe)  │  │  (iframe)  │  ...         │ │
│  │  Suggestions │  │  │  sandbox=  │  │  sandbox=  │              │ │
│  │              │  │  │  "allow-   │  │  "allow-   │              │ │
│  │              │  │  │  scripts"  │  │  scripts"  │              │ │
│  └──────┬───────┘  │  └──────┬─────┘  └──────┬─────┘              │ │
│         │          │         │ postMessage    │ postMessage        │ │
│         │          └─────────┼───────────────┼────────────────────┘ │
│         │                    ▼               ▼                      │
│  ┌──────┴──────────────────────────────────────────────────────┐    │
│  │                    Intent Router                             │    │
│  │  1. Origin check (must be 'null' for srcdoc iframes)        │    │
│  │  2. Source check (iframe.contentWindow === event.source)     │    │
│  │  3. Schema validation (payload matches declared intent)      │    │
│  │  4. Rate limiting (max N intents/second/sandbox)             │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│  ┌──────────────────────────┴──────────────────────────────────┐    │
│  │                 Session Manager                              │    │
│  │  HMAC-SHA256 token lifecycle, auto-refresh before expiry     │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                       │
│  ┌──────────────────────────┴──────────────────────────────────┐    │
│  │                   MCP Client                                 │    │
│  │  Sends AgentQueryRequest with X-Session-Token header         │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTPS POST /api/mcp/query
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  ORCHESTRATION PROXY (Node.js, stateless)           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Middleware Pipeline                                          │   │
│  │  1. CORS (origin: http://localhost:5173)                      │   │
│  │  2. JSON body parsing (limit: 1MB)                            │   │
│  │  3. Session validation (HMAC-SHA256 token + fingerprint)      │   │
│  │  4. Rate limiting (60 req/min per session, in-memory buckets) │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  GIS Agent (LLM Orchestrator)                                 │   │
│  │                                                               │   │
│  │  System Prompt → Claude API (tool_use) → Agentic Loop:        │   │
│  │    1. LLM calls data tools (geocode, search_pois, route)     │   │
│  │    2. Tool results fed back as tool_result messages            │   │
│  │    3. LLM generates UI via render_component tool              │   │
│  │    4. Loop until stop_reason != 'tool_use'                    │   │
│  │                                                               │   │
│  │  Conversation memory: in-process Map<sessionId, entries[]>    │   │
│  │  Max 20 entries per session, no persistence                   │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────┐  ┌───────┴──────┐  ┌──────────────────────────┐  │
│  │ Session       │  │ Data Tools   │  │ UI Tools                 │  │
│  │ Endpoint      │  │              │  │                          │  │
│  │ POST /session │  │ geocode()    │  │ render_component()       │  │
│  │ → HMAC token  │  │ searchPOIs() │  │ show_notification()      │  │
│  │               │  │ calcRoute()  │  │ remove_component()       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                                                                     │
│  NO DATABASE. NO PERSISTENT STATE. NO BUSINESS LOGIC.               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  External APIs (public, free)  │
              │  Nominatim (geocoding)         │
              │  Overpass (POI search)          │
              │  Valhalla (routing)             │
              │  Anthropic (LLM - Claude)       │
              └───────────────────────────────┘
```

### 2.2 Separation of Concerns

| Layer | Responsibility | State | Business Logic |
|-------|---------------|-------|---------------|
| Browser (MCP Host) | Render sandboxed UI, validate intents, manage session token | React state (ephemeral) | None |
| Orchestration Proxy | Authenticate sessions, sign messages, route MCP, rate limit | In-memory Maps (TTL-evicted) | None |
| LLM Agent | Fetch data, decide UI layout, generate HTML/JS components | Context window (ephemeral) | **All** |
| Sandboxed Iframes | Execute agent-generated interactive UI | Local JS variables (per-iframe) | Display only |

---

## 3. Detailed Data Flow

### 3.1 Session Token Lifecycle

The **self-validating cryptographic session token** eliminates all database dependencies for authentication.

**Token creation (proxy-side):**
```
1. Client sends POST /api/session
2. Proxy extracts User-Agent header and client IP address
3. Proxy computes client fingerprint: SHA-256(User-Agent + IP)
4. Proxy constructs payload:
   {
     sid: UUID-v4,           // Unique session identifier
     iat: Date.now(),        // Issued-at timestamp (Unix ms)
     exp: Date.now() + TTL,  // Expiry timestamp (Unix ms)
     fpr: fingerprint         // Client fingerprint hash
   }
5. Proxy encodes payload: encoded = base64url(JSON.stringify(payload))
6. Proxy signs: signature = HMAC-SHA256(encoded, SERVER_SECRET).base64url
7. Proxy returns token: encoded + "." + signature
```

**Token validation (proxy-side, every protected request):**
```
1. Extract token from X-Session-Token header
2. Split on last "." → encoded (payload) + signature
3. Verify: HMAC-SHA256(encoded, SERVER_SECRET) === signature
   → If mismatch: reject (invalid_signature)
4. Decode payload: JSON.parse(base64url.decode(encoded))
5. Check: Date.now() <= payload.exp
   → If expired: reject (token_expired)
6. Compute expected fingerprint: SHA-256(request.User-Agent + request.IP)
7. Check: payload.fpr === expected fingerprint
   → If mismatch: reject (fingerprint_mismatch)
8. Attach payload to request context for downstream middleware
```

**Token refresh (client-side):**
```
1. SessionManager stores token and expiresAt timestamp
2. Sets setTimeout for (expiresAt - 5 minutes) to call initialize() again
3. New token replaces old token transparently
```

**Critical property:** At no point does validation require a database lookup, network call, or any state beyond the token itself and the server secret. The token is the session.

### 3.2 Semantic Intent Routing via postMessage

The **semantic intent routing protocol** provides a type-safe, schema-validated, rate-limited communication channel between cryptographically sandboxed execution partitions and the host application.

**Outbound (sandbox → host):**
```
1. Agent-generated JavaScript inside iframe calls:
   window.parent.postMessage({
     type: 'ui_intent',
     component_id: COMPONENT_ID,    // Injected at render time
     intent: 'marker_click',         // Declared in intent_schema
     payload: { lat: 52.37, lon: 4.89, id: 'cafe-1', name: 'De Koffie' },
     timestamp: Date.now(),
     signature: ''                   // HMAC signature placeholder
   }, '*');

2. Host window receives MessageEvent

3. IntentRouter validates (four layers):
   Layer 1 — Origin check:
     event.origin must be 'null' (srcdoc iframes have null origin)
     Any other origin → silently dropped

   Layer 2 — Source check:
     event.source must match a registered iframe's contentWindow
     Prevents spoofed messages from other windows/tabs
     Unknown source → silently dropped

   Layer 3 — Schema validation:
     The intent name must exist in the component's declared intent_schema
     Every required field must be present with correct type
     Type checking: string, number, boolean, object, array
     Unknown intent or type mismatch → silently dropped

   Layer 4 — Rate limiting:
     Max 10 intents per second per sandbox
     Counter resets after 1-second window
     Exceeded → silently dropped

4. If all four layers pass → forward to registered intent handlers
```

**Inbound (host → sandbox):**
```
1. Host constructs UpdateMessage:
   {
     type: 'ui_update',
     component_id: 'abc123',
     action: 'highlight_marker',
     payload: { id: 'cafe-1', color: '#ff0000' },
     signature: ''
   }

2. Host calls iframe.contentWindow.postMessage(message, '*')

3. Agent-generated JavaScript inside iframe handles the message
   via its own window.addEventListener('message', handler)
```

### 3.3 MCP-Orchestrated Probabilistic UI Generation

The **probabilistic UI generation** flow is the core novel contribution. The LLM agent does not select from predefined templates — it synthesizes complete, self-contained HTML/JavaScript documents on every interaction.

**Complete request lifecycle:**
```
1. User types "Find cafes near Amsterdam" in ChatPanel

2. Client McpClient sends POST /api/mcp/query:
   {
     query: "Find cafes near Amsterdam",
     context: {
       session_id: "abc-123",
       active_components: [],
       viewport: null
     }
   }
   Headers: X-Session-Token: <hmac-signed-token>

3. Proxy validates session token (see 3.1)
4. Proxy rate-limit check passes
5. Proxy forwards to GisAgent.processQuery()

6. GisAgent constructs messages array with system prompt + user context
7. GisAgent calls Claude API with tool definitions:
   - geocode, search_pois, calculate_route (data tools)
   - render_component, show_notification, remove_component (UI tools)

8. AGENTIC LOOP iteration 1:
   Claude responds with tool_use: geocode({query: "Amsterdam"})
   → GisAgent executes: Nominatim API → [{lat: 52.37, lon: 4.89, ...}]
   → Result fed back as tool_result message

9. AGENTIC LOOP iteration 2:
   Claude responds with tool_use: search_pois({poi_type: "cafe", lat: 52.37, lon: 4.89})
   → GisAgent executes: Overpass API → [{name: "De Koffie", lat: 52.371, lon: 4.891}, ...]
   → Result fed back as tool_result message

10. AGENTIC LOOP iteration 3:
    Claude responds with tool_use: render_component({
      html: "<div id='root'>
        <link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'>
        <script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>
        <div id='map' style='width:100%;height:100%'></div>
        <script>
          const map = L.map('map').setView([52.37, 4.89], 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
          const cafes = [{name:'De Koffie',lat:52.371,lon:4.891}, ...];
          cafes.forEach(c => {
            L.marker([c.lat,c.lon]).addTo(map)
              .bindPopup(c.name)
              .on('click', () => {
                window.parent.postMessage({
                  type:'ui_intent', component_id:COMPONENT_ID,
                  intent:'marker_click',
                  payload:{lat:c.lat, lon:c.lon, id:c.name, name:c.name},
                  timestamp:Date.now(), signature:''
                }, '*');
              });
          });
        </script>",
      component_type: "map_view",
      intent_schema: {
        marker_click: {
          lat: {type: "number"}, lon: {type: "number"},
          id: {type: "string"}, name: {type: "string"}
        }
      }
    })
    → GisAgent assigns component_id, replaces {{COMPONENT_ID}} in HTML
    → Component added to response.components[]

    Claude also responds with text: "Found 12 cafes near Amsterdam..."
    → stop_reason: 'end_turn' → exit agentic loop

11. Proxy returns AgentResponse:
    {
      message: "Found 12 cafes near Amsterdam...",
      components: [{
        component_id: "a1b2c3d4",
        html: "...complete self-contained HTML with Leaflet map...",
        metadata: {
          component_type: "map_view",
          sandbox_permissions: ["allow-scripts"],
          intent_schema: { marker_click: {...} }
        }
      }]
    }

12. Client App receives response:
    - Adds assistant message to chat
    - Adds component to components[] state
    - WorkspaceCanvas renders new SandboxFrame

13. SandboxFrame creates:
    <iframe
      sandbox="allow-scripts"
      srcdoc="<!DOCTYPE html>
        <html><head>
          <meta http-equiv='Content-Security-Policy'
            content='default-src none; script-src unsafe-inline
            https://unpkg.com https://cdn.jsdelivr.net;
            style-src unsafe-inline https://unpkg.com;
            img-src https: data:; connect-src none;'>
          ...
        </head><body>
          <script>const COMPONENT_ID = 'a1b2c3d4';</script>
          ...agent-generated HTML/JS...
        </body></html>"
    />

14. Iframe loads, Leaflet map renders, markers appear
15. User clicks a marker → postMessage → IntentRouter validates → handler fires
```

---

## 4. Four-Layer Security Architecture

### 4.1 Layer 1: Cryptographically Sandboxed Execution Partitions (Iframe Sandboxing)

Each agent-generated UI component runs inside an `<iframe>` element with the following security constraints:

**Sandbox attribute:** `sandbox="allow-scripts"`
- Permits: inline JavaScript execution
- Blocks: same-origin access, form submission, popups, pointer lock, top-level navigation, modal dialogs, downloads, screen orientation lock, presentation API, Web Share API

**Content Security Policy (embedded meta tag):**
```
default-src 'none';
script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net;
style-src 'unsafe-inline' https://unpkg.com;
img-src https: data:;
connect-src 'none';
```
- `default-src 'none'` — blocks all resource types by default
- `connect-src 'none'` — **blocks all outbound network requests** (fetch, XMLHttpRequest, WebSocket, EventSource)
- Script sources restricted to inline code and two specific CDN origins (Leaflet, Chart.js)
- The only communication channel to the outside world is `window.parent.postMessage()`

**Implementation:** `packages/client/src/components/SandboxFrame.tsx`

### 4.2 Layer 2: Self-Validating Cryptographic Session Tokens

**Algorithm:** HMAC-SHA256 with timing-safe comparison
**Token format:** `base64url(JSON payload) + "." + HMAC-SHA256(payload, secret)`
**Payload fields:** session ID (UUID v4), issued-at (Unix ms), expiry (Unix ms), client fingerprint (SHA-256 of User-Agent + IP)
**Validation:** No database. Verify HMAC signature → check expiry → check fingerprint. Three constant-time operations.
**Refresh:** Client-side timer refreshes 5 minutes before expiry.

**Implementation:** `packages/proxy/src/crypto/sessionToken.ts`

### 4.3 Layer 3: HTTP Message Signatures (RFC 9421 Subset)

Every MCP request carries three headers per RFC 9421:
- **Content-Digest:** SHA-256 hash of the request body, encoded as `sha-256=:base64:`. Proves body integrity.
- **Signature-Input:** Declares the covered components: `@method`, `@path`, `content-type`, `content-digest`, plus metadata (creation timestamp, key ID, algorithm).
- **Signature:** HMAC-SHA256 of the signature base string (canonical concatenation of covered components per RFC 9421 Section 2.5).

**Verification procedure:**
1. Recompute Content-Digest from actual body. If mismatch → reject.
2. Reconstruct signature base from request components + Signature-Input parameters.
3. HMAC-SHA256 the signature base with session secret. Compare to received Signature. If mismatch → reject.

**Implementation:** `packages/proxy/src/crypto/httpSignatures.ts`

### 4.4 Layer 4: Semantic Intent Validation (postMessage Router)

Four sequential validation gates on every incoming `postMessage`:

1. **Origin gate:** `event.origin` must equal `'null'` (the origin of `srcdoc` iframes per the HTML specification). Any other origin is silently dropped.
2. **Source gate:** `event.source` must be the `contentWindow` of a registered sandbox iframe. Prevents cross-window spoofing.
3. **Schema gate:** The intent name must exist in the component's declared `intent_schema`. Every declared field must be present in the payload with the correct JavaScript type (`string`, `number`, `boolean`, `object`, `array`).
4. **Rate gate:** Maximum 10 intents per second per sandbox. Sliding window counter.

**Implementation:** `packages/client/src/core/IntentRouter.ts`

---

## 5. Ephemeral State Management (Decentralized Session Token Context Window)

### 5.1 State Distribution

This architecture achieves **deterministic state synchronization** without any persistent storage:

| State | Location | Lifetime | Persistence |
|-------|----------|----------|-------------|
| Session identity + auth | HMAC token (client holds, proxy validates) | Token TTL (2 hours) | None — token IS the state |
| Conversation history | In-process Map on proxy + LLM context window | Process lifetime, max 20 entries | None — lost on restart |
| Active UI components | React state (client) | Browser tab lifetime | None — lost on refresh |
| Rate limit counters | In-process Map on proxy | 60-second windows, 5-min eviction | None — lost on restart |
| Per-component UI state | JavaScript variables inside each iframe | Iframe lifetime | None — lost on removal |

### 5.2 Markov Decision Process Formalization

The system can be formalized as a **Markov Decision Process (MDP) web environment**:

- **State S(t):** `{active_components[], viewport, conversation_history[], last_intent}`
- **Action A(t):** LLM response = `{message, components_to_add[], components_to_remove[], notifications[]}`
- **Transition function T(S, A) → S':** Deterministic given the agent's action. The MCP protocol enforces structured transitions — the agent can only add components, remove components, or send notifications. No arbitrary state mutations.
- **Observation O(t):** The agent receives the full state as `AgentContext` on each query: session ID, active component IDs, viewport, conversation summary, and the last user intent.
- **Reward:** Implicit — user continues interacting (sends new queries) vs. abandons session.

The session token encodes a cryptographic commitment to S(t) via the session ID, allowing the proxy to validate continuity without storing state.

---

## 6. Alternative Embodiments and Equivalent Implementations

This section documents alternative approaches that achieve equivalent functionality, to prevent circumvention patents on obvious variations.

### 6.1 Alternative Sandboxing Mechanisms

While this implementation uses inline `srcdoc` iframes with `sandbox="allow-scripts"`:

- **Shadow DOM isolation with Shopify Remote DOM:** The same semantic intent routing protocol can operate between a host application and components rendered via Shopify's Remote DOM library, which provides DOM isolation without iframes. The intent schema validation and rate limiting layers are transport-agnostic.
- **Web Workers with OffscreenCanvas:** For non-visual computation, agent-generated JavaScript can execute inside Web Workers (which inherently lack DOM access), communicating results via the same postMessage protocol. Workers with OffscreenCanvas access can render visualizations without any parent DOM interaction.
- **WebAssembly sandboxes:** Agent-generated computation can be compiled to WebAssembly modules and executed in WASM sandboxes (e.g., Wasmtime's browser embedding), providing memory-level isolation beyond what JavaScript iframes offer.
- **Fenced Frames (Privacy Sandbox):** The emerging `<fencedframe>` HTML element provides similar isolation properties to sandboxed iframes but with additional restrictions on communication. The intent protocol can be adapted to use the Fenced Frames API's restricted communication channels.
- **Service Worker interception:** Rather than direct postMessage, a Service Worker can intercept and validate all messages between sandboxed components and the host, adding an additional validation layer at the browser's network stack level.

### 6.2 Alternative Token Mechanisms

While this implementation uses HMAC-SHA256 self-validating tokens:

- **JWT (JSON Web Tokens):** The token format can be replaced with standard JWT (RFC 7519) using HS256 or RS256 algorithms. The self-validating property is preserved.
- **Macaroons:** The token can be replaced with a Macaroon (contextual caveats), allowing delegated authority and third-party attenuation. Each caveat adds a chained HMAC, maintaining the no-database-lookup property.
- **PASETO (Platform-Agnostic Security Tokens):** PASETO v4.local tokens provide authenticated encryption and are designed as a more opinionated replacement for JWT, eliminating algorithm confusion attacks.
- **Ed25519-signed tokens:** For asymmetric verification (where verifiers need not hold the signing secret), Ed25519 signatures replace HMAC while preserving stateless validation.

### 6.3 Alternative Protocol Transports

While this implementation uses HTTP POST with JSON payloads:

- **WebSocket transport:** The MCP messages can be transported over a persistent WebSocket connection, reducing connection overhead for high-frequency interactions. The HTTP Message Signature scheme adapts by signing each WebSocket frame's payload.
- **Server-Sent Events (SSE) for streaming:** The agent response can stream incrementally via SSE, allowing partial UI rendering before the full response completes. The streaming MCP transport (Streamable HTTP) supports this natively.
- **WebRTC data channels:** For peer-to-peer topologies, the same MCP messages can flow over WebRTC data channels, with DTLS providing transport security and the application-layer HMAC signatures providing message authentication.
- **gRPC-Web:** The MCP protocol can be mapped to Protocol Buffer messages transported via gRPC-Web, providing binary encoding efficiency and strong typing at the transport level.

### 6.4 Alternative LLM Orchestration Patterns

While this implementation uses a single-agent loop with Claude's tool_use API:

- **Multi-agent orchestration:** Multiple specialized LLM agents (a "data agent" for tool calling and a "UI agent" for component generation) can collaborate via an inter-agent MCP protocol, each with its own tool set and system prompt.
- **ReAct (Reasoning + Acting) loop:** The agentic loop can incorporate explicit reasoning traces (chain-of-thought) before each tool call, logged and validated by the proxy for audit purposes.
- **Tree-of-thought exploration:** For complex UI generation tasks, the agent can explore multiple UI designs in parallel (multiple render_component candidates), with the client presenting options for user selection.
- **Local LLM execution:** The orchestration proxy's LLM calls can target a locally-running model (via Ollama, llama.cpp, or vLLM) instead of a cloud API, eliminating external API dependencies while preserving the identical MCP protocol flow.

### 6.5 Alternative State Management

While this implementation uses ephemeral in-process state:

- **Redis-backed conversation cache:** The in-process conversation Map can be replaced with a Redis instance for multi-process deployments, while preserving the "no persistent database" property (Redis data is ephemeral, TTL-evicted, and explicitly not the system of record).
- **Client-side state encryption:** The full conversation history can be encrypted client-side (using the session token as a key derivation input) and stored in sessionStorage, eliminating even the proxy-side in-process memory.
- **CRDTs for multi-tab synchronization:** Conflict-free Replicated Data Types can synchronize the active component list across multiple browser tabs sharing the same session, without a central coordinator.

---

## 7. Build and Deployment Instructions

### 7.1 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- An Anthropic API key (for the LLM agent)

### 7.2 Installation

```bash
git clone https://github.com/mihaics/ai-interface.git
cd ai-interface
npm install
```

This installs all three workspace packages (`@ai-interface/shared`, `@ai-interface/proxy`, `@ai-interface/client`) and their dependencies.

### 7.3 Configuration

```bash
cp .env.example .env
# Edit .env:
#   ANTHROPIC_API_KEY=sk-ant-your-key-here
#   HMAC_SECRET=<generate with: openssl rand -hex 32>
#   PORT=3001
```

### 7.4 Build

```bash
# Build shared types first (proxy and client depend on it)
npm -w packages/shared run build

# Build all packages
npm run build
```

### 7.5 Run (Development)

```bash
# Start both proxy and client concurrently
npm run dev

# Or separately:
npm run dev:proxy    # Express proxy on http://localhost:3001
npm run dev:client   # Vite dev server on http://localhost:5173
```

### 7.6 Run Tests

```bash
npm run test                         # All packages
npm run test:shared                  # HMAC crypto tests
npm run test:proxy                   # Session tokens, HTTP signatures, agent setup, tools
npm run test:client                  # SessionManager, IntentRouter

# Single test file
npx -w packages/proxy vitest run src/crypto/sessionToken.test.ts
```

### 7.7 Production Deployment

```bash
npm run build
# Proxy: node packages/proxy/dist/server.js
# Client: serve packages/client/dist/ with any static file server (nginx, Cloudflare Pages, etc.)
```

The proxy requires the environment variables in `.env`. The client requires the proxy URL (defaults to `http://localhost:3001`, configurable via Vite's proxy setting).

---

## 8. Source File Reference

| File | Purpose | Key Claims |
|------|---------|------------|
| `packages/shared/src/types/session.ts` | Session token payload types | Self-validating token structure |
| `packages/shared/src/types/intent.ts` | Intent message and schema types | Semantic intent routing protocol |
| `packages/shared/src/types/mcp.ts` | MCP message types, AgentContext, UIComponentPayload | MCP-based UI generation protocol |
| `packages/shared/src/crypto/hmac.ts` | HMAC-SHA256 sign/verify, base64url encode/decode | Cryptographic token primitives |
| `packages/proxy/src/crypto/sessionToken.ts` | Token creation and validation with fingerprinting | Self-validating cryptographic session tokens |
| `packages/proxy/src/crypto/httpSignatures.ts` | RFC 9421 subset: sign and verify HTTP messages | HTTP Message Signatures on MCP payloads |
| `packages/proxy/src/middleware/validateSession.ts` | Express middleware for token validation | Stateless session authentication |
| `packages/proxy/src/middleware/rateLimit.ts` | In-memory rate limiter with TTL eviction | Ephemeral rate limiting without database |
| `packages/proxy/src/agent/systemPrompt.ts` | LLM system prompt for generative UI | Probabilistic UI generation instructions |
| `packages/proxy/src/agent/toolRegistry.ts` | Claude tool definitions (data + UI tools) | MCP tool calling definitions |
| `packages/proxy/src/agent/GisAgent.ts` | Agentic loop: tool execution, UI component extraction | LLM orchestrator with dynamic UI synthesis |
| `packages/proxy/src/tools/geocoding.ts` | Nominatim geocoding integration | Data tool implementation |
| `packages/proxy/src/tools/poiSearch.ts` | Overpass POI search integration | Data tool implementation |
| `packages/proxy/src/tools/routing.ts` | Valhalla routing integration | Data tool implementation |
| `packages/client/src/core/SessionManager.ts` | Client-side token lifecycle with auto-refresh | Client-side ephemeral session management |
| `packages/client/src/core/McpClient.ts` | HTTP client for MCP agent queries | MCP Host-to-proxy communication |
| `packages/client/src/core/SandboxRegistry.ts` | Registry of active sandboxed iframe components | Sandbox lifecycle tracking |
| `packages/client/src/core/IntentRouter.ts` | Four-layer postMessage validation | Semantic intent routing with schema enforcement |
| `packages/client/src/components/SandboxFrame.tsx` | Sandboxed iframe renderer with CSP | Cryptographically sandboxed execution partitions |
| `packages/client/src/components/WorkspaceCanvas.tsx` | Grid layout for multiple sandboxed components | Multi-component workspace rendering |
| `packages/client/src/components/ChatPanel.tsx` | User input and agent message display | MCP Host chat interface |
| `packages/client/src/App.tsx` | Application shell: session init, intent routing, agent queries | Full system integration |

---

## 9. Terminology Cross-Reference for Patent Search

This section maps the implementation's terminology to standard patent claim language to ensure discoverability by patent examiners conducting prior art searches.

| Implementation Term | Patent Claim Equivalent |
|---|---|
| Sandboxed iframe with CSP | Cryptographically sandboxed execution partition |
| postMessage intent routing | Semantic intent routing protocol / Inter-process message validation |
| HMAC-SHA256 session token | Self-validating cryptographic session token / Stateless authentication credential |
| No database | Ephemeral session state / Decentralized session token context window |
| LLM generates HTML/JS | Probabilistic user interface generation / Dynamic UI synthesis by machine learning model |
| MCP tool calling | Model Context Protocol orchestration / Agent-mediated tool invocation |
| render_component | Runtime UI component materialization / Dynamic document fragment injection |
| Agent decides data + UI | Autonomous agent-driven interface composition / Unified data-and-presentation orchestration |
| Intent schema validation | Declarative message contract enforcement / Schema-gated inter-frame communication |
| Rate limiting per sandbox | Per-partition throughput governance / Execution partition rate control |
| Content Security Policy | Resource loading restriction policy / Document-level network isolation |
| HTTP Message Signatures | Payload integrity verification / RFC 9421 message authentication |
| Agentic loop | Iterative tool-augmented reasoning / Multi-step autonomous agent execution |
| In-process Map with TTL | Ephemeral in-memory cache with time-based eviction / Non-persistent state storage |
| Fingerprint (UA + IP hash) | Client environment binding / Device-correlated credential anchoring |
| Markov Decision Process formalization | Sequential decision optimization framework / State-action-transition formalization |

---

## 10. Prior Art and Differentiation

This architecture is distinguished from existing systems by the **simultaneous combination** of all of the following properties, none of which are independently novel but whose combination constitutes a novel system architecture:

1. **UI generation is probabilistic, not template-based.** Unlike React Server Components, Next.js, or Streamlit, the LLM agent generates complete, novel HTML/JS documents. The set of possible UIs is unbounded and determined at runtime by the model.

2. **No backend database or persistent state.** Unlike traditional session-based web applications (Rails, Django, Express+MongoDB), all authentication is performed via self-validating cryptographic tokens. There is no session table, no user table, no database server.

3. **Sandboxed execution with schema-validated communication.** Unlike existing micro-frontend architectures (Module Federation, single-spa), each UI component runs in a fully sandboxed iframe with no same-origin access and no network access, communicating only through a schema-validated postMessage protocol.

4. **LLM as sole orchestrator.** Unlike existing LLM-augmented UIs (ChatGPT, Claude.ai, Cursor) where the LLM generates text/code that is interpreted by a predefined frontend, here the LLM generates the actual runtime UI artifacts — the iframe content IS the LLM's output, rendered directly.

5. **MCP as the orchestration protocol.** The Model Context Protocol provides the standardized tool-calling interface through which the agent accesses both data tools (geocoding, routing) and UI tools (render_component), unifying data retrieval and UI generation under a single protocol.

---

*This document is published as prior art under the Apache License 2.0. The explicit patent grant in Section 3 of the Apache License applies to all contributions. This disclosure is intended to be enabling under 35 U.S.C. Section 112 and Article 83 of the European Patent Convention.*
