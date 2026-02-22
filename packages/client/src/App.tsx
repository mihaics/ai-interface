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
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('chat_messages');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
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

  // Persist chat messages
  useEffect(() => {
    try { sessionStorage.setItem('chat_messages', JSON.stringify(messages)); } catch {}
  }, [messages]);

  const addNotification = useCallback((type: Notification['type'], message: string) => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleRemoveComponent = useCallback((id: string) => {
    sandboxRegistryRef.current.unregister(id);
    setComponents(prev => prev.filter(c => c.component_id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    for (const c of components) {
      sandboxRegistryRef.current.unregister(c.component_id);
    }
    setComponents([]);
  }, [components]);

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

  const handleUpload = useCallback(async (file: File) => {
    if (!sessionManagerRef.current) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const token = sessionManagerRef.current.getToken();
      const res = await fetch(`${PROXY_URL}/api/mcp/upload`, {
        method: 'POST',
        headers: { 'X-Session-Token': token || '' },
        body: formData,
      });
      const data = await res.json();
      addNotification('success', `Uploaded: ${data.filename}`);
      handleSend(`I uploaded a file: ${data.filename}`);
    } catch (err: any) {
      addNotification('error', `Upload failed: ${err.message}`);
    }
  }, [addNotification, handleSend]);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: '#0a0a0a', color: '#e0e0e0',
      overflow: 'hidden',
    }}>
      {/* Workspace (main area) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Status bar */}
        <div style={{
          padding: '6px 12px', borderBottom: '1px solid #333',
          fontSize: '11px', color: '#666', display: 'flex', gap: '16px',
          flexShrink: 0,
        }}>
          <span>Status: {isConnected ? 'Connected' : 'Connecting...'}</span>
          <span>Components: {components.length}</span>
          <span>Session: {sessionManagerRef.current?.getSessionId()?.slice(0, 8) || '...'}</span>
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <WorkspaceCanvas
            components={components}
            sandboxRegistry={sandboxRegistryRef.current}
            onRemoveComponent={handleRemoveComponent}
            onClearAll={handleClearAll}
          />
        </div>
      </div>

      {/* Chat panel (right side) */}
      <div style={{ width: '360px', flexShrink: 0 }}>
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          onUpload={handleUpload}
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
