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
