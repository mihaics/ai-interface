import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  onUpload?: (file: File) => void;
  isLoading: boolean;
  activeComponentTypes?: string[];
}

export type { ChatMessage };

const INITIAL_SUGGESTIONS = [
  'Search for latest AI news and show a summary',
  'Show a 3D globe with the 10 largest capitals',
  'Build a unit converter (length, weight, temperature)',
  'Map cafes within 1km of the center of Timișoara',
];

const CONTEXTUAL_SUGGESTIONS: Record<string, string[]> = {
  map_view: [
    'Add the 5 nearest restaurants to the map',
    'Calculate a walking route between two markers',
    'Show bus stops within 500m',
  ],
  data_table: [
    'Create a bar chart from the top 10 rows',
    'Sort this table by the largest column',
    'Summarize key stats from this data',
  ],
  chart: [
    'Switch this to a line chart',
    'Highlight the top 3 values',
    'Explain what this chart shows',
  ],
  web_page: [
    'Summarize this article in 3 bullet points',
    'Search for a different perspective on this topic',
    'Extract the key facts from this page',
  ],
  code_output: [
    'Plot the results as a chart',
    'Optimize this code for speed',
    'Run with different input values',
  ],
  pdf_viewer: [
    'Summarize this PDF in 5 bullet points',
    'Extract the main conclusions',
    'Search for related papers on this topic',
  ],
};

const GENERIC_FOLLOWUPS = [
  'Show this as a different chart type',
  'Search the web for more context',
  'Run a quick Python analysis on this',
  'Compare these results side by side',
];

function getSuggestions(componentTypes: string[]): string[] {
  if (componentTypes.length === 0) return INITIAL_SUGGESTIONS;

  const seen = new Set<string>();
  const result: string[] = [];

  // Add contextual suggestions for active component types
  for (const type of componentTypes) {
    const matches = CONTEXTUAL_SUGGESTIONS[type];
    if (matches) {
      for (const s of matches) {
        if (!seen.has(s) && result.length < 4) {
          seen.add(s);
          result.push(s);
        }
      }
    }
  }

  // Fill remaining slots with generic follow-ups
  for (const s of GENERIC_FOLLOWUPS) {
    if (!seen.has(s) && result.length < 4) {
      seen.add(s);
      result.push(s);
    }
  }

  return result;
}

export function ChatPanel({ messages, onSend, onUpload, isLoading, activeComponentTypes = [] }: ChatPanelProps) {
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

  const suggestions = getSuggestions(activeComponentTypes);

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
        AI Assistant
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#666', fontSize: '13px', padding: '8px' }}>
            Hello! I can search the web, show maps, run code, analyze data, and more. What would you like to do?
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
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 12px',
      }}>
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSend(s)}
            disabled={isLoading}
            style={{
              padding: '4px 10px', borderRadius: '12px', border: '1px solid #444',
              background: 'transparent', color: '#aaa', fontSize: '12px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        display: 'flex', padding: '12px', borderTop: '1px solid #333', gap: '8px',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me anything..."
          disabled={isLoading}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px',
            border: '1px solid #444', background: '#1a1a1a', color: '#e0e0e0',
            fontSize: '13px', outline: 'none',
          }}
        />
        <label style={{
          padding: '8px 12px', borderRadius: '8px', border: '1px solid #444',
          background: '#1a1a1a', color: '#888', fontSize: '13px',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}>
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onUpload?.(file);
              e.target.value = '';
            }}
          />
          Upload
        </label>
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
