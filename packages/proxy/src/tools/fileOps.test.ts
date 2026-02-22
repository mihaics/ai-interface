import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

process.env.SESSION_FILE_DIR = '/tmp/ai-interface-test-sessions';

const { listSessionFiles, getSessionDir } = await import('./fileOps.js');

describe('listSessionFiles', () => {
  const sessionId = 'test-session-123';

  beforeEach(async () => {
    const dir = getSessionDir(sessionId);
    await mkdir(dir, { recursive: true });
  });

  afterEach(async () => {
    await rm(getSessionDir(sessionId), { recursive: true, force: true });
  });

  it('returns empty array when no files', async () => {
    const files = await listSessionFiles(sessionId);
    expect(files).toEqual([]);
  });

  it('lists uploaded files with metadata', async () => {
    const dir = getSessionDir(sessionId);
    await writeFile(join(dir, 'data.csv'), 'a,b,c\n1,2,3');
    await writeFile(join(dir, 'notes.txt'), 'hello world');

    const files = await listSessionFiles(sessionId);
    expect(files).toHaveLength(2);
    expect(files.map((f: any) => f.filename).sort()).toEqual(['data.csv', 'notes.txt']);
    expect(files[0]).toHaveProperty('size');
    expect(files[0]).toHaveProperty('filename');
  });

  it('returns empty array for nonexistent session', async () => {
    const files = await listSessionFiles('nonexistent-session');
    expect(files).toEqual([]);
  });
});
