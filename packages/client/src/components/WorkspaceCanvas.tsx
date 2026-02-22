import { useCallback, useRef, useState } from 'react';
import { SandboxFrame } from './SandboxFrame.js';
import type { UIComponentPayload } from '@ai-interface/shared';
import type { SandboxRegistry } from '../core/SandboxRegistry.js';

const MIN_W = 200;
const MIN_H = 150;
const CASCADE_OFFSET = 30;
const DEFAULT_W = 600;
const DEFAULT_H = 450;
const HANDLE_SIZE = 6;

interface WindowState {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  maximized: boolean;
  minimized: boolean;
  prevBounds?: { x: number; y: number; w: number; h: number };
}

interface WorkspaceCanvasProps {
  components: UIComponentPayload[];
  sandboxRegistry: SandboxRegistry;
  onRemoveComponent: (id: string) => void;
  onClearAll: () => void;
}

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const CURSORS: Record<Edge, string> = {
  n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
  ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
};

export function WorkspaceCanvas({ components, sandboxRegistry, onRemoveComponent, onClearAll }: WorkspaceCanvasProps) {
  const [windows, setWindows] = useState<Record<string, WindowState>>({});
  const zCounterRef = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    type: 'move' | 'resize';
    id: string;
    startX: number;
    startY: number;
    startBounds: { x: number; y: number; w: number; h: number };
    edge?: Edge;
  } | null>(null);

  // Ensure every component has a window state
  const getWindow = useCallback((id: string, index: number): WindowState => {
    if (windows[id]) return windows[id];
    const container = containerRef.current;
    const vw = container?.clientWidth || 1200;
    const vh = container?.clientHeight || 800;
    const w = Math.min(DEFAULT_W, Math.floor(vw * 0.5));
    const h = Math.min(DEFAULT_H, Math.floor(vh * 0.55));
    const cascadeX = CASCADE_OFFSET + (index % 8) * CASCADE_OFFSET;
    const cascadeY = CASCADE_OFFSET + (index % 8) * CASCADE_OFFSET;
    return {
      id, x: cascadeX, y: cascadeY, w, h,
      z: zCounterRef.current++, maximized: false, minimized: false,
    };
  }, [windows]);

  const bringToFront = useCallback((id: string) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], z: zCounterRef.current++ },
    }));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows(prev => {
      const win = prev[id];
      if (!win) return prev;
      const container = containerRef.current;
      if (win.maximized) {
        const pb = win.prevBounds || { x: 30, y: 30, w: DEFAULT_W, h: DEFAULT_H };
        return { ...prev, [id]: { ...win, ...pb, maximized: false, prevBounds: undefined, z: zCounterRef.current++ } };
      }
      return {
        ...prev,
        [id]: {
          ...win, prevBounds: { x: win.x, y: win.y, w: win.w, h: win.h },
          x: 0, y: 0, w: container?.clientWidth || 1200, h: container?.clientHeight || 800,
          maximized: true, z: zCounterRef.current++,
        },
      };
    });
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => {
      const win = prev[id];
      if (!win) return prev;
      return { ...prev, [id]: { ...win, minimized: !win.minimized } };
    });
  }, []);

  // Initialize windows for new components
  const activeWindows: WindowState[] = components.map((c, i) => {
    const win = getWindow(c.component_id, i);
    if (!windows[c.component_id]) {
      // Defer state write to avoid render-during-render
      queueMicrotask(() => {
        setWindows(prev => {
          if (prev[c.component_id]) return prev;
          return { ...prev, [c.component_id]: win };
        });
      });
    }
    return windows[c.component_id] || win;
  });

  // Pointer handlers for drag and resize
  const onPointerDown = useCallback((e: React.PointerEvent, id: string, type: 'move' | 'resize', edge?: Edge) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const win = windows[id];
    if (!win || win.maximized) return;
    bringToFront(id);
    dragRef.current = {
      type, id,
      startX: e.clientX, startY: e.clientY,
      startBounds: { x: win.x, y: win.y, w: win.w, h: win.h },
      edge,
    };
  }, [windows, bringToFront]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const b = drag.startBounds;

    setWindows(prev => {
      const win = prev[drag.id];
      if (!win) return prev;

      if (drag.type === 'move') {
        return { ...prev, [drag.id]: { ...win, x: b.x + dx, y: b.y + dy } };
      }

      // Resize
      let { x, y, w, h } = b;
      const edge = drag.edge!;
      if (edge.includes('e')) w = Math.max(MIN_W, b.w + dx);
      if (edge.includes('s')) h = Math.max(MIN_H, b.h + dy);
      if (edge.includes('w')) {
        const newW = Math.max(MIN_W, b.w - dx);
        x = b.x + b.w - newW;
        w = newW;
      }
      if (edge.includes('n')) {
        const newH = Math.max(MIN_H, b.h - dy);
        y = b.y + b.h - newH;
        h = newH;
      }
      return { ...prev, [drag.id]: { ...win, x, y, w, h } };
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleSandboxLoad = useCallback(
    (component: UIComponentPayload, iframe: HTMLIFrameElement) => {
      sandboxRegistry.register(component.component_id, iframe, component.metadata);
    },
    [sandboxRegistry],
  );

  const minimizedWindows = activeWindows.filter(w => w.minimized);
  const visibleWindows = activeWindows.filter(w => !w.minimized);

  if (components.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#666', fontSize: '14px',
      }}>
        Ask me anything. Try &quot;Search for latest AI news&quot; or &quot;Find cafes in Amsterdam&quot;.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', position: 'relative', overflow: 'hidden' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Clear All button */}
      <div style={{
        position: 'absolute', top: 4, right: 8, zIndex: 999999,
      }}>
        <button
          onClick={onClearAll}
          style={{
            background: 'rgba(0,0,0,0.6)', border: '1px solid #444', color: '#888',
            padding: '2px 10px', borderRadius: '4px', cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          Clear All
        </button>
      </div>

      {/* Floating windows */}
      {visibleWindows.map(win => {
        const component = components.find(c => c.component_id === win.id);
        if (!component) return null;
        return (
          <div
            key={win.id}
            style={{
              position: 'absolute',
              left: win.x, top: win.y, width: win.w, height: win.h,
              zIndex: win.z,
              display: 'flex', flexDirection: 'column',
              borderRadius: '8px',
              border: '1px solid #444',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              background: '#1a1a2e',
              overflow: 'hidden',
            }}
            onPointerDown={() => bringToFront(win.id)}
          >
            {/* Title bar */}
            <div
              style={{
                padding: '5px 8px', background: '#111',
                fontSize: '11px', color: '#999',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: win.maximized ? 'default' : 'grab',
                flexShrink: 0, userSelect: 'none',
                borderBottom: '1px solid #333',
              }}
              onPointerDown={(e) => onPointerDown(e, win.id, 'move')}
              onDoubleClick={() => toggleMaximize(win.id)}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {component.metadata.component_type} — {win.id}
              </span>
              <div style={{ display: 'flex', gap: '2px', flexShrink: 0, marginLeft: 8 }}>
                <WinButton label="–" title="Minimize" onClick={() => toggleMinimize(win.id)} />
                <WinButton label={win.maximized ? '◧' : '□'} title="Maximize" onClick={() => toggleMaximize(win.id)} />
                <WinButton label="×" title="Close" onClick={() => onRemoveComponent(win.id)} color="#c44" />
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <SandboxFrame
                component={component}
                onLoad={(iframe) => handleSandboxLoad(component, iframe)}
              />
            </div>

            {/* Resize handles (skip when maximized) */}
            {!win.maximized && (Object.keys(CURSORS) as Edge[]).map(edge => (
              <div
                key={edge}
                style={{
                  position: 'absolute', zIndex: 1,
                  cursor: CURSORS[edge],
                  ...edgeStyle(edge),
                }}
                onPointerDown={(e) => onPointerDown(e, win.id, 'resize', edge)}
              />
            ))}
          </div>
        );
      })}

      {/* Taskbar for minimized windows */}
      {minimizedWindows.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', gap: 4, padding: '4px 8px',
          background: 'rgba(0,0,0,0.7)', borderTop: '1px solid #333',
          zIndex: 999998, flexWrap: 'wrap',
        }}>
          {minimizedWindows.map(win => {
            const component = components.find(c => c.component_id === win.id);
            return (
              <button
                key={win.id}
                onClick={() => { toggleMinimize(win.id); bringToFront(win.id); }}
                style={{
                  background: '#222', border: '1px solid #555', color: '#ccc',
                  padding: '3px 12px', borderRadius: '4px', cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                {component?.metadata.component_type} — {win.id}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WinButton({ label, title, onClick, color }: { label: string; title: string; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerDown={(e) => e.stopPropagation()}
      title={title}
      style={{
        background: 'none', border: 'none', color: color || '#888',
        cursor: 'pointer', fontSize: '14px', lineHeight: 1,
        padding: '0 5px', borderRadius: '3px',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      {label}
    </button>
  );
}

function edgeStyle(edge: Edge): React.CSSProperties {
  const s = HANDLE_SIZE;
  switch (edge) {
    case 'n':  return { top: -s/2, left: s, right: s, height: s };
    case 's':  return { bottom: -s/2, left: s, right: s, height: s };
    case 'e':  return { right: -s/2, top: s, bottom: s, width: s };
    case 'w':  return { left: -s/2, top: s, bottom: s, width: s };
    case 'nw': return { top: -s/2, left: -s/2, width: s*2, height: s*2 };
    case 'ne': return { top: -s/2, right: -s/2, width: s*2, height: s*2 };
    case 'sw': return { bottom: -s/2, left: -s/2, width: s*2, height: s*2 };
    case 'se': return { bottom: -s/2, right: -s/2, width: s*2, height: s*2 };
  }
}
