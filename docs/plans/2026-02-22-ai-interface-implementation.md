# Agent-Driven Backend-Less UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working agent-driven, backend-less UI where an LLM generates HTML/JS components at runtime, rendered in cryptographically sandboxed iframes via the Model Context Protocol.

**Architecture:** React SPA (MCP Host) + thin Node.js orchestration proxy (security-only, zero business logic). LLM generates UI as HTML/JS payloads delivered through MCP embedded resources. Four-layer security: iframe sandbox, HMAC session tokens, HTTP Message Signatures, postMessage intent validation.

**Tech Stack:** React 19, TypeScript, Vite, Node.js, Express, @modelcontextprotocol/sdk, @anthropic-ai/sdk, Leaflet (CDN), Chart.js (CDN)

**Design doc:** `docs/plans/2026-02-22-ai-interface-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/proxy/package.json`
- Create: `packages/proxy/tsconfig.json`
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/index.html`

**Step 1: Create root monorepo package.json**

```json
{
  "name": "ai-interface",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev:proxy\" \"npm run dev:client\"",
    "dev:proxy": "npm -w packages/proxy run dev",
    "dev:client": "npm -w packages/client run dev",
    "build": "npm -w packages/shared run build && npm -w packages/proxy run build && npm -w packages/client run build",
    "test": "npm -w packages/shared run test && npm -w packages/proxy run test && npm -w packages/client run test",
    "test:shared": "npm -w packages/shared run test",
    "test:proxy": "npm -w packages/proxy run test",
    "test:client": "npm -w packages/client run test"
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

**Step 3: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
HMAC_SECRET=generate-a-random-64-char-hex-string
PORT=3001
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.tsbuildinfo
```

**Step 5: Create packages/shared/package.json**

```json
{
  "name": "@ai-interface/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  }
}
```

**Step 6: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 7: Create packages/proxy/package.json**

```json
{
  "name": "@ai-interface/proxy",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ai-interface/shared": "*",
    "@anthropic-ai/sdk": "^0.39.0",
    "express": "^5.0.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 8: Create packages/proxy/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Step 9: Create packages/client/package.json**

```json
{
  "name": "@ai-interface/client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ai-interface/shared": "*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^26.0.0",
    "vite": "^6.1.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 10: Create packages/client/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

**Step 11: Create packages/client/vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

**Step 12: Create packages/client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Interface</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**Step 13: Install dependencies and verify**

Run: `cd /home/mihai/work/sysop/ai-interface && npm install`
Expected: All three workspaces installed, no errors.

**Step 14: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with client, proxy, and shared packages"
```

---

## Task 2: Shared Types

**Files:**
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/session.ts`
- Create: `packages/shared/src/types/intent.ts`
- Create: `packages/shared/src/types/mcp.ts`

**Step 1: Create session types**

File: `packages/shared/src/types/session.ts`

```typescript
/** HMAC-signed session token payload. */
export interface SessionTokenPayload {
  /** Unique session ID (UUID v4). */
  sid: string;
  /** Issued-at timestamp (Unix ms). */
  iat: number;
  /** Expiry timestamp (Unix ms). */
  exp: number;
  /** Client fingerprint: SHA-256 of User-Agent + IP. */
  fpr: string;
}

/** Session token = base64url(payload) + "." + hmac-sha256(payload, secret). */
export type SessionToken = string;

/** Session creation request (client to proxy). */
export interface SessionCreateRequest {
  /** User-Agent string from browser. */
  userAgent: string;
}

/** Session creation response (proxy to client). */
export interface SessionCreateResponse {
  token: SessionToken;
  expiresAt: number;
}
```

**Step 2: Create intent types**

File: `packages/shared/src/types/intent.ts`

```typescript
/** Schema for a single intent field. */
export interface IntentFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

/** Maps intent names to their payload schemas. */
export type IntentSchema = Record<string, Record<string, IntentFieldSchema>>;

/** Message sent from sandboxed iframe to host via postMessage. */
export interface IntentMessage {
  type: 'ui_intent';
  component_id: string;
  intent: string;
  payload: Record<string, unknown>;
  timestamp: number;
  signature: string;
}

/** Message sent from host to sandboxed iframe via postMessage. */
export interface UpdateMessage {
  type: 'ui_update';
  component_id: string;
  action: string;
  payload: Record<string, unknown>;
  signature: string;
}
```

**Step 3: Create MCP message types**

File: `packages/shared/src/types/mcp.ts`

```typescript
import type { IntentSchema } from './intent.js';

/** Metadata for an agent-generated UI component. */
export interface ComponentMetadata {
  component_type: string;
  sandbox_permissions: string[];
  intent_schema: IntentSchema;
}

/** Agent query request (client to proxy). */
export interface AgentQueryRequest {
  query: string;
  context: AgentContext;
}

/** Context sent with each agent query. */
export interface AgentContext {
  session_id: string;
  active_components: string[];
  viewport?: { center: [number, number]; zoom: number; bounds?: object };
  conversation_summary?: string;
  last_user_intent?: { type: string; payload: Record<string, unknown> };
}

/** A UI component payload from the agent. */
export interface UIComponentPayload {
  component_id: string;
  html: string;
  metadata: ComponentMetadata;
}

/** Agent response (proxy to client). */
export interface AgentResponse {
  message: string;
  components?: UIComponentPayload[];
  remove_components?: string[];
  notifications?: Array<{ type: 'info' | 'success' | 'warning' | 'error'; message: string }>;
}
```

**Step 4: Create barrel export**

File: `packages/shared/src/index.ts`

```typescript
export type * from './types/session.js';
export type * from './types/intent.js';
export type * from './types/mcp.js';
```

**Step 5: Build shared package**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/shared run build`
Expected: Compiles to `packages/shared/dist/` with no errors.

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add session, intent, and MCP message types"
```

---

## Task 3: Shared Crypto — Isomorphic HMAC

**Files:**
- Create: `packages/shared/src/crypto/hmac.ts`
- Create: `packages/shared/src/crypto/hmac.test.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing test**

File: `packages/shared/src/crypto/hmac.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { hmacSign, hmacVerify, base64url } from './hmac.js';

describe('hmac', () => {
  const secret = 'test-secret-key-1234567890';

  it('signs and verifies a payload', () => {
    const payload = 'hello world';
    const signature = hmacSign(payload, secret);
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
    expect(hmacVerify(payload, signature, secret)).toBe(true);
  });

  it('rejects tampered payload', () => {
    const payload = 'hello world';
    const signature = hmacSign(payload, secret);
    expect(hmacVerify('hello world!', signature, secret)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const payload = 'hello world';
    const signature = hmacSign(payload, secret);
    expect(hmacVerify(payload, signature, 'wrong-secret')).toBe(false);
  });
});

describe('base64url', () => {
  it('encodes and decodes round-trip', () => {
    const input = JSON.stringify({ sid: '123', iat: Date.now() });
    const encoded = base64url.encode(input);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    expect(base64url.decode(encoded)).toBe(input);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/shared run test`
Expected: FAIL — module `./hmac.js` not found.

**Step 3: Write the implementation**

File: `packages/shared/src/crypto/hmac.ts`

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Create HMAC-SHA256 signature of a payload.
 * Works in Node.js. For browser use, see WebCrypto wrapper in client package.
 */
export function hmacSign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison.
 */
export function hmacVerify(payload: string, signature: string, secret: string): boolean {
  const expected = hmacSign(payload, secret);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Base64url encode/decode utilities. */
export const base64url = {
  encode(input: string): string {
    return Buffer.from(input).toString('base64url');
  },
  decode(input: string): string {
    return Buffer.from(input, 'base64url').toString('utf-8');
  },
};
```

**Step 4: Update barrel export**

Add to `packages/shared/src/index.ts`:

```typescript
export { hmacSign, hmacVerify, base64url } from './crypto/hmac.js';
```

**Step 5: Run tests**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/shared run test`
Expected: All 4 tests PASS.

**Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add isomorphic HMAC-SHA256 signing and base64url utilities"
```

---

## Task 4: Proxy — Session Token Crypto

**Files:**
- Create: `packages/proxy/src/crypto/sessionToken.ts`
- Create: `packages/proxy/src/crypto/sessionToken.test.ts`

**Step 1: Write the failing test**

File: `packages/proxy/src/crypto/sessionToken.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createSessionToken, validateSessionToken } from './sessionToken.js';

const SECRET = 'test-hmac-secret-64chars-long-abcdefghijklmnopqrstuvwxyz123456';

describe('session tokens', () => {
  it('creates a valid token and validates it', () => {
    const token = createSessionToken('test-user-agent', '127.0.0.1', SECRET, 3600_000);
    expect(typeof token).toBe('string');
    expect(token).toContain('.');

    const result = validateSessionToken(token, 'test-user-agent', '127.0.0.1', SECRET);
    expect(result.valid).toBe(true);
    expect(result.payload?.sid).toBeDefined();
  });

  it('rejects expired tokens', () => {
    const token = createSessionToken('ua', '127.0.0.1', SECRET, -1000);
    const result = validateSessionToken(token, 'ua', '127.0.0.1', SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('token_expired');
  });

  it('rejects tampered tokens', () => {
    const token = createSessionToken('ua', '127.0.0.1', SECRET, 3600_000);
    const tampered = token.slice(0, -5) + 'xxxxx';
    const result = validateSessionToken(tampered, 'ua', '127.0.0.1', SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('rejects mismatched fingerprint', () => {
    const token = createSessionToken('ua', '127.0.0.1', SECRET, 3600_000);
    const result = validateSessionToken(token, 'different-ua', '127.0.0.1', SECRET);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('fingerprint_mismatch');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run test`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

File: `packages/proxy/src/crypto/sessionToken.ts`

```typescript
import { randomUUID, createHash } from 'node:crypto';
import { hmacSign, hmacVerify, base64url } from '@ai-interface/shared';
import type { SessionTokenPayload } from '@ai-interface/shared';

function fingerprint(userAgent: string, ip: string): string {
  return createHash('sha256').update(userAgent + ip).digest('hex');
}

export function createSessionToken(
  userAgent: string,
  ip: string,
  secret: string,
  ttlMs: number = 7_200_000,
): string {
  const payload: SessionTokenPayload = {
    sid: randomUUID(),
    iat: Date.now(),
    exp: Date.now() + ttlMs,
    fpr: fingerprint(userAgent, ip),
  };
  const encoded = base64url.encode(JSON.stringify(payload));
  const signature = hmacSign(encoded, secret);
  return `${encoded}.${signature}`;
}

export interface TokenValidationResult {
  valid: boolean;
  payload?: SessionTokenPayload;
  error?: 'invalid_format' | 'invalid_signature' | 'token_expired' | 'fingerprint_mismatch';
}

export function validateSessionToken(
  token: string,
  userAgent: string,
  ip: string,
  secret: string,
): TokenValidationResult {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex === -1) return { valid: false, error: 'invalid_format' };

  const encoded = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  if (!hmacVerify(encoded, signature, secret)) {
    return { valid: false, error: 'invalid_signature' };
  }

  const payload: SessionTokenPayload = JSON.parse(base64url.decode(encoded));

  if (Date.now() > payload.exp) {
    return { valid: false, error: 'token_expired' };
  }

  if (payload.fpr !== fingerprint(userAgent, ip)) {
    return { valid: false, error: 'fingerprint_mismatch' };
  }

  return { valid: true, payload };
}
```

**Step 4: Run tests**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run test`
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add packages/proxy/src/crypto/
git commit -m "feat(proxy): add HMAC-SHA256 session token creation and validation"
```

---

## Task 5: Proxy — HTTP Message Signatures (RFC 9421 Subset)

**Files:**
- Create: `packages/proxy/src/crypto/httpSignatures.ts`
- Create: `packages/proxy/src/crypto/httpSignatures.test.ts`

**Step 1: Write the failing test**

File: `packages/proxy/src/crypto/httpSignatures.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { signRequest, verifyRequest, computeContentDigest } from './httpSignatures.js';

const SECRET = 'test-signing-secret';

describe('HTTP Message Signatures', () => {
  it('signs and verifies a POST request', () => {
    const method = 'POST';
    const path = '/mcp';
    const contentType = 'application/json';
    const body = JSON.stringify({ query: 'find cafes' });
    const keyId = 'session-abc';

    const headers = signRequest({ method, path, contentType, body, keyId, secret: SECRET });
    expect(headers['signature-input']).toBeDefined();
    expect(headers['signature']).toBeDefined();
    expect(headers['content-digest']).toBeDefined();

    const valid = verifyRequest({
      method, path, contentType, body,
      signatureInput: headers['signature-input'],
      signature: headers['signature'],
      contentDigest: headers['content-digest'],
      secret: SECRET,
    });
    expect(valid).toBe(true);
  });

  it('rejects tampered body', () => {
    const headers = signRequest({
      method: 'POST', path: '/mcp', contentType: 'application/json',
      body: '{"query":"find cafes"}', keyId: 'abc', secret: SECRET,
    });

    const valid = verifyRequest({
      method: 'POST', path: '/mcp', contentType: 'application/json',
      body: '{"query":"find hotels"}',
      signatureInput: headers['signature-input'],
      signature: headers['signature'],
      contentDigest: headers['content-digest'],
      secret: SECRET,
    });
    expect(valid).toBe(false);
  });

  it('computes correct content digest', () => {
    const digest = computeContentDigest('hello');
    expect(digest).toMatch(/^sha-256=:/);
    expect(digest).toMatch(/:$/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run test`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

File: `packages/proxy/src/crypto/httpSignatures.ts`

```typescript
import { createHash, createHmac } from 'node:crypto';

export function computeContentDigest(body: string): string {
  const hash = createHash('sha256').update(body).digest('base64');
  return `sha-256=:${hash}:`;
}

interface SignRequestParams {
  method: string;
  path: string;
  contentType: string;
  body: string;
  keyId: string;
  secret: string;
}

export function signRequest(params: SignRequestParams): Record<string, string> {
  const { method, path, contentType, body, keyId, secret } = params;
  const created = Math.floor(Date.now() / 1000);
  const contentDigest = computeContentDigest(body);

  const signatureInput = `sig1=("@method" "@path" "content-type" "content-digest");created=${created};keyid="${keyId}";alg="hmac-sha256"`;

  // Build signature base per RFC 9421
  const signatureBase = [
    `"@method": ${method.toUpperCase()}`,
    `"@path": ${path}`,
    `"content-type": ${contentType}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${signatureInput.split('=', 2)[1] || signatureInput}`,
  ].join('\n');

  const sig = createHmac('sha256', secret).update(signatureBase).digest('base64');

  return {
    'signature-input': signatureInput,
    'signature': `sig1=:${sig}:`,
    'content-digest': contentDigest,
  };
}

interface VerifyRequestParams {
  method: string;
  path: string;
  contentType: string;
  body: string;
  signatureInput: string;
  signature: string;
  contentDigest: string;
  secret: string;
}

export function verifyRequest(params: VerifyRequestParams): boolean {
  const { method, path, contentType, body, signatureInput, signature, contentDigest, secret } = params;

  // Verify content digest first
  const expectedDigest = computeContentDigest(body);
  if (contentDigest !== expectedDigest) return false;

  // Rebuild signature base
  const signatureBase = [
    `"@method": ${method.toUpperCase()}`,
    `"@path": ${path}`,
    `"content-type": ${contentType}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${signatureInput.split('=', 2)[1] || signatureInput}`,
  ].join('\n');

  const expectedSig = createHmac('sha256', secret).update(signatureBase).digest('base64');
  const receivedSig = signature.replace(/^sig1=:|:$/g, '');

  return expectedSig === receivedSig;
}
```

**Step 4: Run tests**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run test`
Expected: All tests PASS (session token + HTTP signatures).

**Step 5: Commit**

```bash
git add packages/proxy/src/crypto/httpSignatures*
git commit -m "feat(proxy): add HTTP Message Signatures (RFC 9421 subset) for MCP payloads"
```

---

## Task 6: Proxy — Express Server with Security Middleware

**Files:**
- Create: `packages/proxy/src/server.ts`
- Create: `packages/proxy/src/routes/session.ts`
- Create: `packages/proxy/src/middleware/validateSession.ts`
- Create: `packages/proxy/src/middleware/rateLimit.ts`

**Step 1: Create session validation middleware**

File: `packages/proxy/src/middleware/validateSession.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';
import { validateSessionToken } from '../crypto/sessionToken.js';

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-change-in-production';

export function validateSession(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['x-session-token'] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'missing_session_token' });
    return;
  }

  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.socket.remoteAddress || '';

  const result = validateSessionToken(token, userAgent, ip, HMAC_SECRET);
  if (!result.valid) {
    res.status(401).json({ error: result.error });
    return;
  }

  // Attach session payload to request for downstream use
  (req as any).session = result.payload;
  next();
}
```

**Step 2: Create rate limiter middleware**

File: `packages/proxy/src/middleware/rateLimit.ts`

```typescript
import type { Request, Response, NextFunction } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();
const MAX_REQUESTS_PER_WINDOW = 60;
const WINDOW_MS = 60_000;

// Evict expired buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 300_000);

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const sessionId = (req as any).session?.sid || req.ip || 'unknown';
  const now = Date.now();

  let bucket = buckets.get(sessionId);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(sessionId, bucket);
  }

  bucket.count++;

  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: 'rate_limit_exceeded' });
    return;
  }

  next();
}
```

**Step 3: Create session route**

File: `packages/proxy/src/routes/session.ts`

```typescript
import { Router } from 'express';
import { createSessionToken } from '../crypto/sessionToken.js';

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-change-in-production';
const TOKEN_TTL_MS = 7_200_000; // 2 hours

export const sessionRouter = Router();

sessionRouter.post('/session', (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.socket.remoteAddress || '';

  const token = createSessionToken(userAgent, ip, HMAC_SECRET, TOKEN_TTL_MS);
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  res.json({ token, expiresAt });
});
```

**Step 4: Create Express server**

File: `packages/proxy/src/server.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { sessionRouter } from './routes/session.js';
import { validateSession } from './middleware/validateSession.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Session creation (no auth required)
app.use('/api', sessionRouter);

// Protected routes require valid session token
app.use('/api/mcp', validateSession, rateLimit);

// MCP agent endpoint (placeholder — Task 9 fills this in)
app.post('/api/mcp/query', (req, res) => {
  res.json({ message: 'MCP endpoint placeholder', components: [], notifications: [] });
});

app.listen(PORT, () => {
  console.log(`Orchestration proxy running on port ${PORT}`);
});

export { app };
```

**Step 5: Verify server starts**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run dev`
Expected: "Orchestration proxy running on port 3001". Kill with Ctrl+C.

**Step 6: Commit**

```bash
git add packages/proxy/src/
git commit -m "feat(proxy): add Express server with session auth, rate limiting, and CORS"
```

---

## Task 7: Proxy — Data Tools (Geocoding, POI Search, Routing)

**Files:**
- Create: `packages/proxy/src/tools/geocoding.ts`
- Create: `packages/proxy/src/tools/poiSearch.ts`
- Create: `packages/proxy/src/tools/routing.ts`
- Create: `packages/proxy/src/tools/geocoding.test.ts`

**Step 1: Write a failing geocoding test**

File: `packages/proxy/src/tools/geocoding.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { geocode, reverseGeocode } from './geocoding.js';

describe('geocoding', () => {
  it('exports geocode function', () => {
    expect(typeof geocode).toBe('function');
  });

  it('exports reverseGeocode function', () => {
    expect(typeof reverseGeocode).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run test`
Expected: FAIL — module not found.

**Step 3: Implement geocoding tool**

File: `packages/proxy/src/tools/geocoding.ts`

```typescript
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface GeocodingResult {
  lat: number;
  lon: number;
  display_name: string;
  type: string;
}

export async function geocode(query: string): Promise<GeocodingResult[]> {
  const url = new URL('/search', NOMINATIM_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ai-interface/1.0' },
  });
  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string; type: string }>;

  return data.map(r => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    display_name: r.display_name,
    type: r.type,
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = new URL('/reverse', NOMINATIM_URL);
  url.searchParams.set('lat', lat.toString());
  url.searchParams.set('lon', lon.toString());
  url.searchParams.set('format', 'json');

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ai-interface/1.0' },
  });
  const data = await res.json() as { display_name: string };
  return data.display_name;
}
```

**Step 4: Implement POI search tool**

File: `packages/proxy/src/tools/poiSearch.ts`

```typescript
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface POIResult {
  id: number;
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export async function searchPOIs(
  poiType: string,
  lat: number,
  lon: number,
  radiusMeters: number = 1000,
): Promise<POIResult[]> {
  const query = `[out:json][timeout:10];
    node["amenity"="${poiType}"](around:${radiusMeters},${lat},${lon});
    out body;`;

  for (const baseUrl of OVERPASS_URLS) {
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const data = await res.json() as { elements: Array<{ id: number; lat: number; lon: number; tags: Record<string, string> }> };

      return data.elements.map(el => ({
        id: el.id,
        name: el.tags?.name || 'Unnamed',
        lat: el.lat,
        lon: el.lon,
        tags: el.tags || {},
      }));
    } catch {
      continue;
    }
  }

  return [];
}
```

**Step 5: Implement routing tool**

File: `packages/proxy/src/tools/routing.ts`

```typescript
const VALHALLA_URL = process.env.VALHALLA_URL || 'https://valhalla1.openstreetmap.de';

interface RouteResult {
  distance_km: number;
  duration_minutes: number;
  geometry: Array<[number, number]>;
  instructions: string[];
}

export async function calculateRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  mode: 'auto' | 'bicycle' | 'pedestrian' = 'auto',
): Promise<RouteResult> {
  const body = {
    locations: [
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
    ],
    costing: mode,
    directions_options: { units: 'kilometers' },
  };

  const res = await fetch(`${VALHALLA_URL}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json() as any;

  const leg = data.trip?.legs?.[0];
  if (!leg) throw new Error('No route found');

  const geometry = decodePolyline(leg.shape);
  const instructions = (leg.maneuvers || []).map((m: any) => m.instruction);

  return {
    distance_km: Math.round((data.trip.summary.length || 0) * 100) / 100,
    duration_minutes: Math.round((data.trip.summary.time || 0) / 60 * 10) / 10,
    geometry,
    instructions,
  };
}

/** Decode Valhalla's encoded polyline (precision 6). */
function decodePolyline(encoded: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let index = 0, lat = 0, lon = 0;

  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / 1e6, lon / 1e6]);
  }
  return coords;
}
```

**Step 6: Run tests**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run test`
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add packages/proxy/src/tools/
git commit -m "feat(proxy): add geocoding, POI search, and routing data tools"
```

---

## Task 8: Proxy — LLM Agent with Tool Calling and UI Generation

**Files:**
- Create: `packages/proxy/src/agent/systemPrompt.ts`
- Create: `packages/proxy/src/agent/toolRegistry.ts`
- Create: `packages/proxy/src/agent/GisAgent.ts`
- Create: `packages/proxy/src/routes/mcp.ts`
- Modify: `packages/proxy/src/server.ts`

**Step 1: Create system prompt**

File: `packages/proxy/src/agent/systemPrompt.ts`

```typescript
export const SYSTEM_PROMPT = `You are a GIS agent that controls a map-based user interface. You have two modes of output:

## Mode 1: Tool Calls
Call the available tools to fetch data (geocoding, POI search, routing) before generating UI.

## Mode 2: Generative UI
After fetching data, generate interactive UI components as self-contained HTML/JS. Return them via the render_component tool.

## UI Component Rules
When generating HTML for render_component:
1. The HTML must be fully self-contained — all CSS inline, all JS inline.
2. For maps: use Leaflet from CDN: <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
3. For charts: use Chart.js from CDN: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
4. To send intents back to the host, use: window.parent.postMessage({type:'ui_intent', component_id:COMPONENT_ID, intent:'intent_name', payload:{...}, timestamp:Date.now(), signature:''}, '*');
5. Always include the COMPONENT_ID variable that will be injected: <script>const COMPONENT_ID = '{{COMPONENT_ID}}';</script>
6. Declare what intents your component can emit in the metadata.intent_schema.
7. Make the UI responsive and visually clean. Use a dark theme (#1a1a2e background, #e0e0e0 text).

## Available Intents for Map Components
- marker_click: {lat: number, lon: number, id: string, name: string}
- viewport_change: {center: [number, number], zoom: number}
- area_select: {bounds: {north, south, east, west}}

## Response Format
Always respond with a JSON object:
{
  "message": "Natural language response to the user",
  "tool_calls_needed": true/false
}

After all tool calls complete, the system will ask you to generate the final UI.
Do NOT use markdown in the message field — plain text only.
Always show results visually on the map when location data is involved.
`;
```

**Step 2: Create tool registry**

File: `packages/proxy/src/agent/toolRegistry.ts`

```typescript
import type Anthropic from '@anthropic-ai/sdk';

/** Tool definitions for Claude's tool_use feature. */
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'geocode',
    description: 'Resolve a place name to geographic coordinates. Returns lat/lon and display name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Place name to search for (e.g., "Amsterdam", "Eiffel Tower")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_pois',
    description: 'Search for points of interest near a location. Returns names, coordinates, and tags.',
    input_schema: {
      type: 'object' as const,
      properties: {
        poi_type: { type: 'string', description: 'OSM amenity type (e.g., "cafe", "restaurant", "hospital", "hotel")' },
        lat: { type: 'number', description: 'Center latitude' },
        lon: { type: 'number', description: 'Center longitude' },
        radius: { type: 'number', description: 'Search radius in meters (default 1000)' },
      },
      required: ['poi_type', 'lat', 'lon'],
    },
  },
  {
    name: 'calculate_route',
    description: 'Calculate a route between two points. Returns distance, duration, and geometry.',
    input_schema: {
      type: 'object' as const,
      properties: {
        from_lat: { type: 'number' },
        from_lon: { type: 'number' },
        to_lat: { type: 'number' },
        to_lon: { type: 'number' },
        mode: { type: 'string', enum: ['auto', 'bicycle', 'pedestrian'], description: 'Travel mode (default auto)' },
      },
      required: ['from_lat', 'from_lon', 'to_lat', 'to_lon'],
    },
  },
  {
    name: 'render_component',
    description: 'Render an interactive UI component in the user\'s workspace. The HTML must be self-contained with inline CSS/JS. Use Leaflet CDN for maps, Chart.js CDN for charts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        html: { type: 'string', description: 'Complete self-contained HTML document for the component' },
        component_type: { type: 'string', description: 'Type identifier (e.g., "map_view", "data_table", "chart")' },
        intent_schema: {
          type: 'object',
          description: 'Map of intent names to their payload field schemas. Example: {"marker_click": {"lat": {"type": "number"}, "lon": {"type": "number"}}}',
        },
      },
      required: ['html', 'component_type'],
    },
  },
  {
    name: 'show_notification',
    description: 'Show a toast notification to the user.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Notification text' },
        type: { type: 'string', enum: ['info', 'success', 'warning', 'error'], description: 'Notification type' },
      },
      required: ['message', 'type'],
    },
  },
  {
    name: 'remove_component',
    description: 'Remove a UI component from the workspace.',
    input_schema: {
      type: 'object' as const,
      properties: {
        component_id: { type: 'string', description: 'ID of the component to remove' },
      },
      required: ['component_id'],
    },
  },
];
```

**Step 3: Create the GIS Agent**

File: `packages/proxy/src/agent/GisAgent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { geocode } from '../tools/geocoding.js';
import { searchPOIs } from '../tools/poiSearch.js';
import { calculateRoute } from '../tools/routing.js';
import type { AgentQueryRequest, AgentResponse, UIComponentPayload } from '@ai-interface/shared';

const client = new Anthropic();

interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string | Anthropic.ContentBlock[];
}

const sessionMemories = new Map<string, ConversationEntry[]>();
const MAX_MEMORY = 20;

function getMemory(sessionId: string): ConversationEntry[] {
  if (!sessionMemories.has(sessionId)) {
    sessionMemories.set(sessionId, []);
  }
  return sessionMemories.get(sessionId)!;
}

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  switch (name) {
    case 'geocode': {
      const results = await geocode(input.query);
      return JSON.stringify(results);
    }
    case 'search_pois': {
      const results = await searchPOIs(input.poi_type, input.lat, input.lon, input.radius);
      return JSON.stringify(results);
    }
    case 'calculate_route': {
      const result = await calculateRoute(
        input.from_lat, input.from_lon, input.to_lat, input.to_lon, input.mode,
      );
      return JSON.stringify(result);
    }
    case 'render_component':
    case 'show_notification':
    case 'remove_component':
      // UI tools — return the input as-is; the caller extracts them from tool_use blocks
      return JSON.stringify({ status: 'queued', ...input });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function processQuery(request: AgentQueryRequest): Promise<AgentResponse> {
  const { query, context } = request;
  const memory = getMemory(context.session_id);

  const contextBlock = `Session: ${context.session_id}
Active components: ${context.active_components.join(', ') || 'none'}
${context.viewport ? `Viewport: center=[${context.viewport.center}], zoom=${context.viewport.zoom}` : ''}
${context.last_user_intent ? `Last intent: ${JSON.stringify(context.last_user_intent)}` : ''}

User: ${query}`;

  // Build messages from memory
  const messages: Anthropic.MessageParam[] = [
    ...memory.map(e => ({ role: e.role as 'user' | 'assistant', content: e.content as any })),
    { role: 'user', content: contextBlock },
  ];

  const components: UIComponentPayload[] = [];
  const removeComponents: string[] = [];
  const notifications: AgentResponse['notifications'] = [];
  let agentMessage = '';

  // Agentic loop: keep calling until no more tool_use
  let continueLoop = true;
  while (continueLoop) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // Process content blocks
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        agentMessage += block.text;
      } else if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input as Record<string, any>);

        // Extract UI actions from tool calls
        if (block.name === 'render_component') {
          const input = block.input as any;
          const componentId = randomUUID().slice(0, 8);
          components.push({
            component_id: componentId,
            html: input.html.replace(/\{\{COMPONENT_ID\}\}/g, componentId),
            metadata: {
              component_type: input.component_type || 'unknown',
              sandbox_permissions: ['allow-scripts'],
              intent_schema: input.intent_schema || {},
            },
          });
        } else if (block.name === 'show_notification') {
          const input = block.input as any;
          notifications.push({ type: input.type, message: input.message });
        } else if (block.name === 'remove_component') {
          removeComponents.push((block.input as any).component_id);
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }

    if (response.stop_reason === 'tool_use' && toolResults.length > 0) {
      // Add assistant response and tool results, continue loop
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    } else {
      continueLoop = false;
    }
  }

  // Update memory (keep last N entries)
  memory.push({ role: 'user', content: contextBlock });
  memory.push({ role: 'assistant', content: agentMessage });
  if (memory.length > MAX_MEMORY) {
    memory.splice(0, memory.length - MAX_MEMORY);
  }

  return {
    message: agentMessage,
    components: components.length > 0 ? components : undefined,
    remove_components: removeComponents.length > 0 ? removeComponents : undefined,
    notifications: notifications.length > 0 ? notifications : undefined,
  };
}
```

**Step 4: Create MCP route**

File: `packages/proxy/src/routes/mcp.ts`

```typescript
import { Router } from 'express';
import { processQuery } from '../agent/GisAgent.js';
import type { AgentQueryRequest } from '@ai-interface/shared';

export const mcpRouter = Router();

mcpRouter.post('/query', async (req, res) => {
  try {
    const request = req.body as AgentQueryRequest;

    if (!request.query || !request.context?.session_id) {
      res.status(400).json({ error: 'Missing query or context.session_id' });
      return;
    }

    const response = await processQuery(request);
    res.json(response);
  } catch (error: any) {
    console.error('Agent error:', error);
    res.status(500).json({
      message: 'An error occurred processing your request.',
      error: error.message,
    });
  }
});
```

**Step 5: Update server.ts to use MCP router**

Replace the placeholder in `packages/proxy/src/server.ts`:

Replace the line:
```typescript
app.post('/api/mcp/query', (req, res) => {
  res.json({ message: 'MCP endpoint placeholder', components: [], notifications: [] });
});
```

With:
```typescript
import { mcpRouter } from './routes/mcp.js';

// ... (after the validateSession + rateLimit middleware line)
app.use('/api/mcp', mcpRouter);
```

And remove the old placeholder route. The full server.ts should import and mount `mcpRouter` on `/api/mcp`.

**Step 6: Verify server starts with agent**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/proxy run dev`
Expected: Server starts. (Agent won't work without ANTHROPIC_API_KEY but should not crash on startup.)

**Step 7: Commit**

```bash
git add packages/proxy/src/agent/ packages/proxy/src/routes/mcp.ts packages/proxy/src/server.ts
git commit -m "feat(proxy): add LLM agent with tool calling, UI generation, and MCP route"
```

---

## Task 9: Client — Session Manager and MCP Client

**Files:**
- Create: `packages/client/src/core/SessionManager.ts`
- Create: `packages/client/src/core/McpClient.ts`
- Create: `packages/client/src/core/SessionManager.test.ts`

**Step 1: Write failing test**

File: `packages/client/src/core/SessionManager.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { SessionManager } from './SessionManager.js';

describe('SessionManager', () => {
  it('starts with no token', () => {
    const sm = new SessionManager('http://localhost:3001');
    expect(sm.getToken()).toBeNull();
    expect(sm.isAuthenticated()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/client run test`
Expected: FAIL — module not found.

**Step 3: Implement SessionManager**

File: `packages/client/src/core/SessionManager.ts`

```typescript
import type { SessionCreateResponse, SessionToken } from '@ai-interface/shared';

export class SessionManager {
  private token: SessionToken | null = null;
  private expiresAt: number = 0;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly baseUrl: string) {}

  async initialize(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Session creation failed: ${res.status}`);

    const data = (await res.json()) as SessionCreateResponse;
    this.token = data.token;
    this.expiresAt = data.expiresAt;

    // Refresh 5 minutes before expiry
    const refreshIn = Math.max(0, this.expiresAt - Date.now() - 300_000);
    this.refreshTimer = setTimeout(() => this.initialize(), refreshIn);
  }

  getToken(): SessionToken | null {
    if (this.token && Date.now() >= this.expiresAt) {
      this.token = null;
    }
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  getSessionId(): string | null {
    if (!this.token) return null;
    try {
      const payload = this.token.split('.')[0];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded).sid;
    } catch {
      return null;
    }
  }

  destroy(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.token = null;
    this.expiresAt = 0;
  }
}
```

**Step 4: Implement MCP Client**

File: `packages/client/src/core/McpClient.ts`

```typescript
import type { AgentQueryRequest, AgentResponse, AgentContext } from '@ai-interface/shared';
import type { SessionManager } from './SessionManager.js';

export class McpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly sessionManager: SessionManager,
  ) {}

  async query(userQuery: string, context: Partial<AgentContext>): Promise<AgentResponse> {
    const token = this.sessionManager.getToken();
    if (!token) throw new Error('No active session');

    const sessionId = this.sessionManager.getSessionId();
    if (!sessionId) throw new Error('Cannot extract session ID');

    const request: AgentQueryRequest = {
      query: userQuery,
      context: {
        session_id: sessionId,
        active_components: context.active_components || [],
        viewport: context.viewport,
        conversation_summary: context.conversation_summary,
        last_user_intent: context.last_user_intent,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/mcp/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': token,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'unknown' }));
      throw new Error(`Agent query failed: ${(error as any).error || res.status}`);
    }

    return (await res.json()) as AgentResponse;
  }
}
```

**Step 5: Run tests**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/client run test`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/client/src/core/SessionManager* packages/client/src/core/McpClient*
git commit -m "feat(client): add SessionManager with auto-refresh and McpClient for agent queries"
```

---

## Task 10: Client — Sandbox Registry and Intent Router

**Files:**
- Create: `packages/client/src/core/SandboxRegistry.ts`
- Create: `packages/client/src/core/IntentRouter.ts`
- Create: `packages/client/src/core/IntentRouter.test.ts`

**Step 1: Write failing test**

File: `packages/client/src/core/IntentRouter.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { IntentRouter } from './IntentRouter.js';
import { SandboxRegistry } from './SandboxRegistry.js';

describe('IntentRouter', () => {
  it('rejects messages from unknown sources', () => {
    const registry = new SandboxRegistry();
    const router = new IntentRouter(registry);
    const handled: any[] = [];
    router.onIntent((componentId, intent, payload) => handled.push({ componentId, intent, payload }));

    // Simulate a message with no matching source
    const event = new MessageEvent('message', {
      origin: 'null',
      data: { type: 'ui_intent', component_id: 'unknown', intent: 'click', payload: {}, timestamp: Date.now(), signature: '' },
    });
    router.handleMessage(event);

    expect(handled).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/client run test`
Expected: FAIL — modules not found.

**Step 3: Implement SandboxRegistry**

File: `packages/client/src/core/SandboxRegistry.ts`

```typescript
import type { IntentSchema, ComponentMetadata } from '@ai-interface/shared';

export interface SandboxEntry {
  componentId: string;
  iframe: HTMLIFrameElement;
  intentSchema: IntentSchema;
  metadata: ComponentMetadata;
  requestCount: number;
  lastRequestTime: number;
}

export class SandboxRegistry {
  private entries = new Map<string, SandboxEntry>();

  register(
    componentId: string,
    iframe: HTMLIFrameElement,
    metadata: ComponentMetadata,
  ): void {
    this.entries.set(componentId, {
      componentId,
      iframe,
      intentSchema: metadata.intent_schema,
      metadata,
      requestCount: 0,
      lastRequestTime: 0,
    });
  }

  unregister(componentId: string): void {
    this.entries.delete(componentId);
  }

  getByComponentId(componentId: string): SandboxEntry | undefined {
    return this.entries.get(componentId);
  }

  /** Find entry by iframe contentWindow reference (for postMessage source matching). */
  getBySource(source: MessageEventSource | null): SandboxEntry | undefined {
    if (!source) return undefined;
    for (const entry of this.entries.values()) {
      if (entry.iframe.contentWindow === source) return entry;
    }
    return undefined;
  }

  getActiveComponentIds(): string[] {
    return Array.from(this.entries.keys());
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
```

**Step 4: Implement IntentRouter**

File: `packages/client/src/core/IntentRouter.ts`

```typescript
import type { IntentMessage, IntentFieldSchema } from '@ai-interface/shared';
import type { SandboxRegistry, SandboxEntry } from './SandboxRegistry.js';

type IntentHandler = (componentId: string, intent: string, payload: Record<string, unknown>) => void;

const MAX_INTENTS_PER_SECOND = 10;

export class IntentRouter {
  private handlers: IntentHandler[] = [];

  constructor(private readonly registry: SandboxRegistry) {}

  onIntent(handler: IntentHandler): void {
    this.handlers.push(handler);
  }

  /** Attach to window message events. Call this once on app init. */
  attach(): () => void {
    const listener = (event: MessageEvent) => this.handleMessage(event);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }

  /** Process a single message event. Exported for testing. */
  handleMessage(event: MessageEvent): void {
    // Layer 1: Origin check — srcDoc iframes have origin 'null'
    if (event.origin !== 'null') return;

    // Layer 2: Source check — must be a registered sandbox
    const entry = this.registry.getBySource(event.source);
    if (!entry) return;

    // Parse the intent message
    const data = event.data as IntentMessage;
    if (data?.type !== 'ui_intent') return;
    if (!data.component_id || !data.intent) return;

    // Layer 3: Schema validation
    if (!this.validateSchema(data, entry)) return;

    // Layer 4: Rate limiting
    if (!this.checkRateLimit(entry)) return;

    // Forward to handlers
    for (const handler of this.handlers) {
      handler(data.component_id, data.intent, data.payload);
    }
  }

  private validateSchema(data: IntentMessage, entry: SandboxEntry): boolean {
    const schema = entry.intentSchema[data.intent];
    if (!schema) return false; // Unknown intent

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const value = data.payload[field];
      if (value === undefined) return false; // Missing required field
      if (!this.checkType(value, fieldSchema)) return false;
    }
    return true;
  }

  private checkType(value: unknown, schema: IntentFieldSchema): boolean {
    switch (schema.type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'object': return typeof value === 'object' && value !== null;
      case 'array': return Array.isArray(value);
      default: return false;
    }
  }

  private checkRateLimit(entry: SandboxEntry): boolean {
    const now = Date.now();
    if (now - entry.lastRequestTime > 1000) {
      entry.requestCount = 0;
    }
    entry.requestCount++;
    entry.lastRequestTime = now;
    return entry.requestCount <= MAX_INTENTS_PER_SECOND;
  }
}
```

**Step 5: Run tests**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/client run test`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add packages/client/src/core/SandboxRegistry* packages/client/src/core/IntentRouter*
git commit -m "feat(client): add SandboxRegistry and IntentRouter with 4-layer validation"
```

---

## Task 11: Client — SandboxFrame Component

**Files:**
- Create: `packages/client/src/components/SandboxFrame.tsx`

**Step 1: Implement SandboxFrame**

File: `packages/client/src/components/SandboxFrame.tsx`

```tsx
import { useEffect, useRef, useCallback } from 'react';
import type { UIComponentPayload, UpdateMessage } from '@ai-interface/shared';

interface SandboxFrameProps {
  component: UIComponentPayload;
  onLoad?: (iframe: HTMLIFrameElement) => void;
  onError?: (error: string) => void;
}

/**
 * Renders an agent-generated UI component inside a sandboxed iframe.
 *
 * Security properties:
 * - sandbox="allow-scripts" only (no same-origin, no forms, no popups)
 * - CSP via meta tag inside srcDoc
 * - No network access (connect-src 'none')
 * - Only escape hatch is postMessage to parent
 */
export function SandboxFrame({ component, onLoad, onError }: SandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = buildSrcDoc(component);

  const handleLoad = useCallback(() => {
    if (iframeRef.current && onLoad) {
      onLoad(iframeRef.current);
    }
  }, [onLoad]);

  const handleError = useCallback(() => {
    onError?.(`Failed to load component: ${component.component_id}`);
  }, [onError, component.component_id]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      onError={handleError}
      title={`Component: ${component.metadata.component_type}`}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#1a1a2e',
      }}
    />
  );
}

function buildSrcDoc(component: UIComponentPayload): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://unpkg.com; img-src https: data:; connect-src 'none';">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; overflow: hidden; }
    #root { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <script>const COMPONENT_ID = '${component.component_id}';</script>
  ${component.html}
</body>
</html>`;
}

/** Send an update message to a sandboxed iframe. */
export function sendUpdateToSandbox(
  iframe: HTMLIFrameElement,
  componentId: string,
  action: string,
  payload: Record<string, unknown>,
): void {
  const message: UpdateMessage = {
    type: 'ui_update',
    component_id: componentId,
    action,
    payload,
    signature: '', // Host-to-iframe signing can be added later
  };
  iframe.contentWindow?.postMessage(message, '*');
}
```

**Step 2: Commit**

```bash
git add packages/client/src/components/SandboxFrame.tsx
git commit -m "feat(client): add SandboxFrame component with CSP and iframe sandboxing"
```

---

## Task 12: Client — WorkspaceCanvas and ChatPanel Components

**Files:**
- Create: `packages/client/src/components/WorkspaceCanvas.tsx`
- Create: `packages/client/src/components/ChatPanel.tsx`
- Create: `packages/client/src/components/NotificationToast.tsx`

**Step 1: Implement WorkspaceCanvas**

File: `packages/client/src/components/WorkspaceCanvas.tsx`

```tsx
import { useCallback } from 'react';
import { SandboxFrame } from './SandboxFrame.js';
import type { UIComponentPayload } from '@ai-interface/shared';
import type { SandboxRegistry } from '../core/SandboxRegistry.js';

interface WorkspaceCanvasProps {
  components: UIComponentPayload[];
  sandboxRegistry: SandboxRegistry;
}

export function WorkspaceCanvas({ components, sandboxRegistry }: WorkspaceCanvasProps) {
  const handleSandboxLoad = useCallback(
    (component: UIComponentPayload, iframe: HTMLIFrameElement) => {
      sandboxRegistry.register(component.component_id, iframe, component.metadata);
    },
    [sandboxRegistry],
  );

  if (components.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#666', fontSize: '14px',
      }}>
        Ask me something to get started. Try "Find cafes in Amsterdam".
      </div>
    );
  }

  const gridCols = components.length === 1 ? 1 : 2;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
      gap: '8px',
      height: '100%',
      padding: '8px',
    }}>
      {components.map(component => (
        <div key={component.component_id} style={{
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #333',
          minHeight: '300px',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '4px 8px', background: 'rgba(0,0,0,0.6)',
            fontSize: '11px', color: '#888', zIndex: 1,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{component.metadata.component_type}</span>
            <span>{component.component_id}</span>
          </div>
          <SandboxFrame
            component={component}
            onLoad={(iframe) => handleSandboxLoad(component, iframe)}
          />
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Implement ChatPanel**

File: `packages/client/src/components/ChatPanel.tsx`

```tsx
import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

export type { ChatMessage };

export function ChatPanel({ messages, onSend, isLoading }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const suggestions = [
    'Find cafes in Amsterdam',
    'Show hospitals near Paris',
    'Route from Berlin to Munich',
    'Find parks in London',
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      borderLeft: '1px solid #333', background: '#111',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #333',
        fontSize: '14px', fontWeight: 'bold', color: '#e0e0e0',
      }}>
        AI Interface
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#666', fontSize: '13px', padding: '8px' }}>
            Hello! I'm your GIS assistant. I'll generate interactive map visualizations based on your requests.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: '1.5',
            maxWidth: '90%',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            background: msg.role === 'user' ? '#2563eb' : '#222',
            color: '#e0e0e0',
          }}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{
            padding: '8px 12px', borderRadius: '8px', background: '#222',
            color: '#888', fontSize: '13px', fontStyle: 'italic',
          }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px',
        }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => onSend(s)}
              style={{
                padding: '4px 10px', borderRadius: '12px', border: '1px solid #444',
                background: 'transparent', color: '#aaa', fontSize: '12px', cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex', padding: '12px', borderTop: '1px solid #333', gap: '8px',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me anything about maps..."
          disabled={isLoading}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px',
            border: '1px solid #444', background: '#1a1a1a', color: '#e0e0e0',
            fontSize: '13px', outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: '#2563eb', color: '#fff', fontSize: '13px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

**Step 3: Implement NotificationToast**

File: `packages/client/src/components/NotificationToast.tsx`

```tsx
import { useEffect, useState } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface NotificationToastProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}

export type { Notification };

const COLORS: Record<string, string> = {
  info: '#2563eb',
  success: '#16a34a',
  warning: '#ca8a04',
  error: '#dc2626',
};

export function NotificationToast({ notifications, onDismiss }: NotificationToastProps) {
  return (
    <div style={{
      position: 'fixed', top: '16px', right: '16px',
      display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000,
    }}>
      {notifications.map(n => (
        <ToastItem key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div style={{
      padding: '10px 16px', borderRadius: '8px',
      background: '#222', color: '#e0e0e0', fontSize: '13px',
      borderLeft: `4px solid ${COLORS[notification.type]}`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      minWidth: '250px', maxWidth: '400px',
      cursor: 'pointer',
    }}
      onClick={() => onDismiss(notification.id)}
    >
      {notification.message}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add packages/client/src/components/
git commit -m "feat(client): add WorkspaceCanvas, ChatPanel, and NotificationToast components"
```

---

## Task 13: Client — App Shell and Main Entry Point

**Files:**
- Create: `packages/client/src/App.tsx`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/styles/global.css`

**Step 1: Implement App.tsx**

File: `packages/client/src/App.tsx`

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionManager } from './core/SessionManager.js';
import { McpClient } from './core/McpClient.js';
import { SandboxRegistry } from './core/SandboxRegistry.js';
import { IntentRouter } from './core/IntentRouter.js';
import { ChatPanel, type ChatMessage } from './components/ChatPanel.js';
import { WorkspaceCanvas } from './components/WorkspaceCanvas.js';
import { NotificationToast, type Notification } from './components/NotificationToast.js';
import type { UIComponentPayload } from '@ai-interface/shared';

const PROXY_URL = 'http://localhost:3001';

export function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [components, setComponents] = useState<UIComponentPayload[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const sessionManagerRef = useRef<SessionManager | null>(null);
  const mcpClientRef = useRef<McpClient | null>(null);
  const sandboxRegistryRef = useRef(new SandboxRegistry());
  const intentRouterRef = useRef<IntentRouter | null>(null);

  // Initialize session and intent router
  useEffect(() => {
    const sm = new SessionManager(PROXY_URL);
    const mc = new McpClient(PROXY_URL, sm);
    const registry = sandboxRegistryRef.current;
    const router = new IntentRouter(registry);

    sessionManagerRef.current = sm;
    mcpClientRef.current = mc;
    intentRouterRef.current = router;

    // Set up intent handler
    router.onIntent((componentId, intent, payload) => {
      console.log(`Intent received: ${intent} from ${componentId}`, payload);
      // Forward intents as context for next agent query
      addNotification('info', `Intent: ${intent} from ${componentId}`);
    });

    const detachRouter = router.attach();

    // Initialize session
    sm.initialize()
      .then(() => setIsConnected(true))
      .catch((err) => {
        console.error('Session init failed:', err);
        addNotification('error', 'Failed to connect to server. Is the proxy running?');
      });

    return () => {
      detachRouter();
      sm.destroy();
    };
  }, []);

  const addNotification = useCallback((type: Notification['type'], message: string) => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleSend = useCallback(async (userMessage: string) => {
    if (!mcpClientRef.current) return;

    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: Date.now() }]);
    setIsLoading(true);

    try {
      const response = await mcpClientRef.current.query(userMessage, {
        active_components: sandboxRegistryRef.current.getActiveComponentIds(),
      });

      // Add assistant message
      if (response.message) {
        setMessages(prev => [...prev, {
          role: 'assistant', content: response.message, timestamp: Date.now(),
        }]);
      }

      // Render new components
      if (response.components) {
        setComponents(prev => [...prev, ...response.components!]);
      }

      // Remove components
      if (response.remove_components) {
        for (const id of response.remove_components) {
          sandboxRegistryRef.current.unregister(id);
        }
        setComponents(prev => prev.filter(c => !response.remove_components!.includes(c.component_id)));
      }

      // Show notifications
      if (response.notifications) {
        for (const n of response.notifications) {
          addNotification(n.type, n.message);
        }
      }
    } catch (err: any) {
      addNotification('error', err.message || 'Request failed');
      setMessages(prev => [...prev, {
        role: 'assistant', content: `Error: ${err.message}`, timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: '#0a0a0a', color: '#e0e0e0',
    }}>
      {/* Workspace (main area) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Status bar */}
        <div style={{
          padding: '6px 12px', borderBottom: '1px solid #333',
          fontSize: '11px', color: '#666', display: 'flex', gap: '16px',
        }}>
          <span>Status: {isConnected ? 'Connected' : 'Connecting...'}</span>
          <span>Components: {components.length}</span>
          <span>Session: {sessionManagerRef.current?.getSessionId()?.slice(0, 8) || '...'}</span>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1 }}>
          <WorkspaceCanvas
            components={components}
            sandboxRegistry={sandboxRegistryRef.current}
          />
        </div>
      </div>

      {/* Chat panel (right side) */}
      <div style={{ width: '360px', flexShrink: 0 }}>
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </div>

      {/* Notifications */}
      <NotificationToast
        notifications={notifications}
        onDismiss={dismissNotification}
      />
    </div>
  );
}
```

**Step 2: Create main entry point**

File: `packages/client/src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 3: Create global styles**

File: `packages/client/src/styles/global.css`

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #0a0a0a;
  color: #e0e0e0;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 3px;
}

input:focus, button:focus {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}
```

**Step 4: Verify client builds**

Run: `cd /home/mihai/work/sysop/ai-interface && npm -w packages/client run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/client/src/
git commit -m "feat(client): add App shell with session init, chat panel, and workspace canvas"
```

---

## Task 14: Integration — End-to-End Smoke Test

**Files:**
- Create: `packages/proxy/src/agent/GisAgent.test.ts`

**Step 1: Write an integration-level test for the agent flow**

File: `packages/proxy/src/agent/GisAgent.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from './toolRegistry.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';

describe('agent setup', () => {
  it('has all required tool definitions', () => {
    const toolNames = TOOL_DEFINITIONS.map(t => t.name);
    expect(toolNames).toContain('geocode');
    expect(toolNames).toContain('search_pois');
    expect(toolNames).toContain('calculate_route');
    expect(toolNames).toContain('render_component');
    expect(toolNames).toContain('show_notification');
    expect(toolNames).toContain('remove_component');
  });

  it('system prompt instructs generative UI', () => {
    expect(SYSTEM_PROMPT).toContain('render_component');
    expect(SYSTEM_PROMPT).toContain('self-contained');
    expect(SYSTEM_PROMPT).toContain('Leaflet');
    expect(SYSTEM_PROMPT).toContain('postMessage');
    expect(SYSTEM_PROMPT).toContain('COMPONENT_ID');
  });

  it('render_component tool accepts html and intent_schema', () => {
    const renderTool = TOOL_DEFINITIONS.find(t => t.name === 'render_component');
    expect(renderTool).toBeDefined();
    const props = (renderTool!.input_schema as any).properties;
    expect(props.html).toBeDefined();
    expect(props.intent_schema).toBeDefined();
  });
});
```

**Step 2: Run all tests across all packages**

Run: `cd /home/mihai/work/sysop/ai-interface && npm run test`
Expected: All tests PASS across shared, proxy, and client.

**Step 3: Verify full dev stack starts**

Run in two terminals:
- Terminal 1: `cd /home/mihai/work/sysop/ai-interface && npm run dev:proxy`
- Terminal 2: `cd /home/mihai/work/sysop/ai-interface && npm run dev:client`

Expected:
- Proxy: "Orchestration proxy running on port 3001"
- Client: Vite dev server on http://localhost:5173
- Browser: Shows the AI Interface with chat panel and empty workspace

**Step 4: Commit**

```bash
git add packages/proxy/src/agent/GisAgent.test.ts
git commit -m "test: add agent setup integration tests and verify end-to-end stack"
```

---

## Task 15: CLAUDE.md and Project Documentation

**Files:**
- Create: `CLAUDE.md`

**Step 1: Create project CLAUDE.md**

File: `CLAUDE.md`

```markdown
# CLAUDE.md — AI Interface Project

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
```

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
npm -w packages/proxy run test      # Session tokens, HTTP signatures, agent setup
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
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with architecture overview and patent-relevant file mapping"
```

---

## Summary of Tasks

| # | Task | Key Patent Claim Addressed |
|---|------|---------------------------|
| 1 | Project scaffolding | — |
| 2 | Shared types | MCP protocol types |
| 3 | Shared crypto (HMAC) | Cryptographic session tokens |
| 4 | Proxy session tokens | HMAC-SHA256 self-validating tokens |
| 5 | Proxy HTTP signatures | RFC 9421 message signatures |
| 6 | Proxy Express server | Security middleware stack |
| 7 | Proxy data tools | MCP tool calling |
| 8 | Proxy LLM agent | Generative UI via MCP |
| 9 | Client session + MCP client | Session lifecycle |
| 10 | Client sandbox + intent router | Iframe sandboxing, postMessage validation |
| 11 | Client SandboxFrame | Iframe sandbox="allow-scripts" + CSP |
| 12 | Client workspace + chat | UI layout |
| 13 | Client App shell | Full integration |
| 14 | Integration tests | End-to-end verification |
| 15 | CLAUDE.md | Documentation |
