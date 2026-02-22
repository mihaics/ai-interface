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
