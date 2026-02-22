import { useCallback, useEffect, useRef } from 'react';
import { SandboxFrame } from './SandboxFrame.js';
import type { UIComponentPayload } from '@ai-interface/shared';
import type { SandboxRegistry } from '../core/SandboxRegistry.js';

interface WorkspaceCanvasProps {
  components: UIComponentPayload[];
  sandboxRegistry: SandboxRegistry;
  onRemoveComponent: (id: string) => void;
  onClearAll: () => void;
}

export function WorkspaceCanvas({ components, sandboxRegistry, onRemoveComponent, onClearAll }: WorkspaceCanvasProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSandboxLoad = useCallback(
    (component: UIComponentPayload, iframe: HTMLIFrameElement) => {
      sandboxRegistry.register(component.component_id, iframe, component.metadata);
    },
    [sandboxRegistry],
  );

  // Auto-scroll to newest component
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [components.length]);

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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '4px 8px', display: 'flex', justifyContent: 'flex-end',
        borderBottom: '1px solid #222', flexShrink: 0,
      }}>
        <button
          onClick={onClearAll}
          style={{
            background: 'none', border: '1px solid #444', color: '#888',
            padding: '2px 10px', borderRadius: '4px', cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Clear All
        </button>
      </div>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {components.map(component => (
          <div key={component.component_id} style={{
            position: 'relative',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #333',
            height: '500px',
            flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '4px 8px', background: 'rgba(0,0,0,0.6)',
              fontSize: '11px', color: '#888', zIndex: 1,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{component.metadata.component_type} — {component.component_id}</span>
              <button
                onClick={() => onRemoveComponent(component.component_id)}
                style={{
                  background: 'none', border: 'none', color: '#888',
                  cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                  padding: '0 4px',
                }}
                title="Close component"
              >
                x
              </button>
            </div>
            <SandboxFrame
              component={component}
              onLoad={(iframe) => handleSandboxLoad(component, iframe)}
            />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
