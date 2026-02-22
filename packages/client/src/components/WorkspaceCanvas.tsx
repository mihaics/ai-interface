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
