import { createHash, createHmac } from 'node:crypto';

export function computeContentDigest(body: string): string {
  const hash = createHash('sha256').update(body).digest('base64');
  return `sha-256=:${hash}:`;
}

interface SignRequestParams {
  method: string;
  path: string;
  contentType: string;
  body: string;
  keyId: string;
  secret: string;
}

export function signRequest(params: SignRequestParams): Record<string, string> {
  const { method, path, contentType, body, keyId, secret } = params;
  const created = Math.floor(Date.now() / 1000);
  const contentDigest = computeContentDigest(body);

  const signatureInput = `sig1=("@method" "@path" "content-type" "content-digest");created=${created};keyid="${keyId}";alg="hmac-sha256"`;

  // Build signature base per RFC 9421
  const signatureBase = [
    `"@method": ${method.toUpperCase()}`,
    `"@path": ${path}`,
    `"content-type": ${contentType}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${signatureInput.split('=', 2)[1] || signatureInput}`,
  ].join('\n');

  const sig = createHmac('sha256', secret).update(signatureBase).digest('base64');

  return {
    'signature-input': signatureInput,
    'signature': `sig1=:${sig}:`,
    'content-digest': contentDigest,
  };
}

interface VerifyRequestParams {
  method: string;
  path: string;
  contentType: string;
  body: string;
  signatureInput: string;
  signature: string;
  contentDigest: string;
  secret: string;
}

export function verifyRequest(params: VerifyRequestParams): boolean {
  const { method, path, contentType, body, signatureInput, signature, contentDigest, secret } = params;

  // Verify content digest first
  const expectedDigest = computeContentDigest(body);
  if (contentDigest !== expectedDigest) return false;

  // Rebuild signature base
  const signatureBase = [
    `"@method": ${method.toUpperCase()}`,
    `"@path": ${path}`,
    `"content-type": ${contentType}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${signatureInput.split('=', 2)[1] || signatureInput}`,
  ].join('\n');

  const expectedSig = createHmac('sha256', secret).update(signatureBase).digest('base64');
  const receivedSig = signature.replace(/^sig1=:|:$/g, '');

  return expectedSig === receivedSig;
}
