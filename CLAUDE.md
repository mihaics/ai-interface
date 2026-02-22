# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A patent-demonstrating implementation of an agent-driven, backend-less UI via the Model Context Protocol (MCP). The LLM generates actual HTML/JS UI components at runtime, rendered in cryptographically sandboxed iframes.

## Architecture

- **packages/client/** — React SPA (MCP Host). Renders agent-generated UI in sandboxed iframes. Validates postMessage intents.
- **packages/proxy/** — Node.js orchestration proxy. Stateless security gateway: HMAC session tokens, HTTP Message Signatures, rate limiting. Zero business logic.
- **packages/shared/** — Shared TypeScript types and crypto utilities.

## Development

```bash
npm install                    # Install all workspaces
npm run dev                    # Start proxy + client concurrently
npm run test                   # Run all tests
npm run dev:proxy              # Proxy only (port 3001)
npm run dev:client             # Client only (port 5173)
npm run test:shared            # Shared tests only
npm run test:proxy             # Proxy tests only
npm run test:client            # Client tests only
```

Single test file: `npx -w packages/proxy vitest run src/crypto/sessionToken.test.ts`

Requires: `ANTHROPIC_API_KEY` in `.env` (copy from `.env.example`).

## Key Concepts

### Generative UI
The LLM generates complete HTML/JS UI components via the `render_component` tool. These are NOT predefined templates — the LLM decides both the data AND the visual representation at runtime.

### Four-Layer Security
1. **Iframe sandbox** — `sandbox="allow-scripts"` + CSP meta tag. No parent DOM access, no network requests.
2. **Session tokens** — HMAC-SHA256 signed, self-validating (no DB lookup). Contains session ID, expiry, client fingerprint.
3. **HTTP Message Signatures** — RFC 9421 subset. Every MCP message signed with content digest.
4. **Intent validation** — postMessage from iframes validated: origin check, source check, schema validation, rate limiting.

### No Database
All state is ephemeral: client React state, LLM conversation memory (in-process Map), proxy rate-limit counters (in-process Map with TTL eviction).

## Testing

```bash
npm -w packages/shared run test     # Crypto utilities
npm -w packages/proxy run test      # Session tokens, HTTP signatures, agent setup, tools
npm -w packages/client run test     # SessionManager, IntentRouter
```

## Patent-Relevant Files

| Claim | File |
|-------|------|
| Iframe sandboxing + CSP | `packages/client/src/components/SandboxFrame.tsx` |
| HMAC session tokens | `packages/proxy/src/crypto/sessionToken.ts` |
| HTTP Message Signatures | `packages/proxy/src/crypto/httpSignatures.ts` |
| postMessage intent validation | `packages/client/src/core/IntentRouter.ts` |
| Generative UI via MCP | `packages/proxy/src/agent/GisAgent.ts` |
| MCP tool definitions | `packages/proxy/src/agent/toolRegistry.ts` |
| LLM system prompt (UI generation instructions) | `packages/proxy/src/agent/systemPrompt.ts` |
