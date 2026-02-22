import { useCallback, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { SandboxFrame } from './SandboxFrame.js';
import type { UIComponentPayload } from '@ai-interface/shared';
import type { SandboxRegistry } from '../core/SandboxRegistry.js';

const ResponsiveGrid = WidthProvider(Responsive);

interface WorkspaceCanvasProps {
  components: UIComponentPayload[];
  sandboxRegistry: SandboxRegistry;
  onRemoveComponent: (id: string) => void;
  onClearAll: () => void;
}

export function WorkspaceCanvas({ components, sandboxRegistry, onRemoveComponent, onClearAll }: WorkspaceCanvasProps) {
  const handleSandboxLoad = useCallback(
    (component: UIComponentPayload, iframe: HTMLIFrameElement) => {
      sandboxRegistry.register(component.component_id, iframe, component.metadata);
    },
    [sandboxRegistry],
  );

  const layouts = useMemo(() => {
    return components.map((c, i) => ({
      i: c.component_id,
      x: 0,
      y: i * 6,
      w: 12,
      h: 6,
      minW: 4,
      minH: 3,
    }));
  }, [components]);

  if (components.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#666', fontSize: '14px',
      }}>
        Ask me anything. Try "Search for latest AI news" or "Find cafes in Amsterdam".
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
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ResponsiveGrid
          layouts={{ lg: layouts }}
          breakpoints={{ lg: 800, sm: 0 }}
          cols={{ lg: 12, sm: 6 }}
          rowHeight={60}
          compactType="vertical"
          draggableHandle=".tile-handle"
          isResizable={true}
          isDraggable={true}
        >
          {components.map(component => (
            <div key={component.component_id} style={{
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div className="tile-handle" style={{
                padding: '4px 8px', background: 'rgba(0,0,0,0.6)',
                fontSize: '11px', color: '#888',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'grab', flexShrink: 0,
              }}>
                <span>{component.metadata.component_type} — {component.component_id}</span>
                <button
                  onClick={() => onRemoveComponent(component.component_id)}
                  style={{
                    background: 'none', border: 'none', color: '#888',
                    cursor: 'pointer', fontSize: '14px', lineHeight: 1,
                    padding: '0 4px',
                  }}
                  title="Close"
                >
                  x
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <SandboxFrame
                  component={component}
                  onLoad={(iframe) => handleSandboxLoad(component, iframe)}
                />
              </div>
            </div>
          ))}
        </ResponsiveGrid>
      </div>
    </div>
  );
}
