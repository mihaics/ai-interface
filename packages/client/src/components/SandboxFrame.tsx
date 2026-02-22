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
        backgroundColor: '#1a1a2e',
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; overflow: auto; }
    #root { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <script>var COMPONENT_ID = '${component.component_id}';</script>
  ${component.html}
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
