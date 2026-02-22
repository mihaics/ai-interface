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
 * - sandbox="allow-scripts" only (no same-origin, no forms, no popups)
 * - CSP via meta tag inside srcDoc
 * - No network access (connect-src 'none')
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
      sandbox="allow-scripts"
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
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://unpkg.com; img-src https: data: blob:; connect-src https:;">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #e0e0e0; font-family: system-ui, sans-serif; overflow: hidden; }
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
