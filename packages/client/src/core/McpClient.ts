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
