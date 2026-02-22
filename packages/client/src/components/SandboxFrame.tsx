import { useRef, useCallback } from 'react';
import type { UIComponentPayload, UpdateMessage } from '@ai-interface/shared';

interface SandboxFrameProps {
  component: UIComponentPayload;
  onLoad?: (iframe: HTMLIFrameElement) => void;
  onError?: (error: string) => void;
}

/**
 * Renders an agent-generated UI component inside a sandboxed iframe.
 *
 * Security properties:
 * - sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" (no same-origin, no forms)
 * - CSP allows any HTTPS CDN for scripts/styles (maximum LLM freedom)
 * - Security boundary is the sandbox attribute, not CSP
 * - Only escape hatch is postMessage to parent
 */
export function SandboxFrame({ component, onLoad, onError }: SandboxFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcDoc = buildSrcDoc(component);

  const handleLoad = useCallback(() => {
    if (iframeRef.current && onLoad) {
      onLoad(iframeRef.current);
    }
  }, [onLoad]);

  const handleError = useCallback(() => {
    onError?.(`Failed to load component: ${component.component_id}`);
  }, [onError, component.component_id]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      onError={handleError}
      title={`Component: ${component.metadata.component_type}`}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#0a0a1a',
      }}
    />
  );
}

function buildSrcDoc(component: UIComponentPayload): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_blank" rel="noopener noreferrer">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; connect-src https: blob: data:; worker-src blob:; media-src https: blob: data:;">
  <script type="importmap">
  {
    "imports": {
      "three": "https://esm.sh/three",
      "three/": "https://esm.sh/three/",
      "chart.js": "https://esm.sh/chart.js",
      "chart.js/auto": "https://esm.sh/chart.js/auto",
      "d3": "https://esm.sh/d3",
      "mermaid": "https://esm.sh/mermaid",
      "marked": "https://esm.sh/marked",
      "lodash": "https://esm.sh/lodash-es",
      "canvas-confetti": "https://esm.sh/canvas-confetti"
    }
  }
  </script>
  <style>
    :root {
      /* Backgrounds */
      --bg-base: #0a0a1a;
      --bg-surface: #141428;
      --bg-elevated: #1e1e3a;
      /* Text */
      --text-primary: #e8e8f0;
      --text-secondary: #9898b0;
      --text-muted: #585870;
      /* Accents */
      --accent: #3b82f6;
      --accent-hover: #60a5fa;
      /* States */
      --success: #4ade80;
      --warning: #fbbf24;
      --error: #f87171;
      /* UI */
      --border: rgba(255, 255, 255, 0.08);
      --radius: 8px;
      --shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
      /* Spacing */
      --space-1: 0.25rem;
      --space-2: 0.5rem;
      --space-3: 1rem;
      --space-4: 1.5rem;
      --space-5: 2rem;
      --space-6: 3rem;
      /* Fonts */
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--bg-base);
      color: var(--text-primary);
      font-family: var(--font-sans);
      overflow: auto;
      line-height: 1.5;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { color: var(--accent-hover); text-decoration: underline; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

    #root { width: 100vw; height: 100vh; }

    /* Utility classes */
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: var(--space-4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--space-3);
    }

    /* Loading spinner */
    #_loading {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483647;
      background: var(--bg-base);
    }
    #_loading::after {
      content: '';
      width: 28px; height: 28px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: _spin 0.7s linear infinite;
    }
    @keyframes _spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="_loading"></div>
  <script>var COMPONENT_ID = '${component.component_id}';</script>
  <script>
    window.onerror = function(msg, src, line, col, err) {
      try {
        parent.postMessage({
          type: 'component_error',
          component_id: COMPONENT_ID,
          error: String(msg),
          stack: err && err.stack ? err.stack : ''
        }, '*');
      } catch(e) {}
    };
    window.onunhandledrejection = function(ev) {
      var r = ev.reason || {};
      try {
        parent.postMessage({
          type: 'component_error',
          component_id: COMPONENT_ID,
          error: r.message || String(r),
          stack: r.stack || ''
        }, '*');
      } catch(e) {}
    };
  </script>
  ${component.html}
  <script>requestAnimationFrame(function(){setTimeout(function(){var l=document.getElementById('_loading');if(l)l.remove();},100)});</script>
</body>
</html>`;
}

/** Send an update message to a sandboxed iframe. */
export function sendUpdateToSandbox(
  iframe: HTMLIFrameElement,
  componentId: string,
  action: string,
  payload: Record<string, unknown>,
): void {
  const message: UpdateMessage = {
    type: 'ui_update',
    component_id: componentId,
    action,
    payload,
    signature: '', // Host-to-iframe signing can be added later
  };
  iframe.contentWindow?.postMessage(message, '*');
}
