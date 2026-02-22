import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const SESSION_FILE_DIR = process.env.SESSION_FILE_DIR || '/tmp/ai-interface-sessions';

export function getSessionDir(sessionId: string): string {
  return join(SESSION_FILE_DIR, sessionId.replace(/[^a-zA-Z0-9-]/g, ''));
}

export async function readSessionFile(
  sessionId: string,
  filename: string,
): Promise<{ content: string; mime_type: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(getSessionDir(sessionId), safeName);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${safeName}`);
  }

  const content = await readFile(filePath, 'utf-8');
  const ext = safeName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    csv: 'text/csv', json: 'application/json', txt: 'text/plain',
    html: 'text/html', md: 'text/markdown', js: 'text/javascript',
    py: 'text/x-python', xml: 'application/xml', yaml: 'text/yaml',
  };

  return { content, mime_type: mimeMap[ext] || 'text/plain' };
}

export async function listSessionFiles(
  sessionId: string,
): Promise<Array<{ filename: string; size: number }>> {
  const dir = getSessionDir(sessionId);
  if (!existsSync(dir)) return [];

  const entries = await readdir(dir);
  const files: Array<{ filename: string; size: number }> = [];

  for (const entry of entries) {
    const fileStat = await stat(join(dir, entry));
    if (fileStat.isFile()) {
      files.push({ filename: entry, size: fileStat.size });
    }
  }

  return files;
}

export async function writeSessionFile(
  sessionId: string,
  filename: string,
  content: string,
): Promise<{ path: string; download_url: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const dir = getSessionDir(sessionId);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, safeName);
  await writeFile(filePath, content, 'utf-8');

  return {
    path: filePath,
    download_url: `/api/files/${sessionId}/${safeName}`,
  };
}
