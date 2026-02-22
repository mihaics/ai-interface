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
