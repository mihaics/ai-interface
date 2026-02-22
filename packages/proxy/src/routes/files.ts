import { Router } from 'express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { getSessionDir } from '../tools/fileOps.js';

export const filesRouter = Router();

filesRouter.get('/files/:sessionId/:filename', (req, res) => {
  const { sessionId, filename } = req.params;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
  const filePath = join(getSessionDir(sessionId), safeName);

  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.download(filePath, safeName);
});
