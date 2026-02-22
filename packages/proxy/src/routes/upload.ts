import { Router } from 'express';
import multer from 'multer';
import { getSessionDir } from '../tools/fileOps.js';
import { mkdir } from 'node:fs/promises';

export const uploadRouter = Router();

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const sessionId = (_req as any).sessionId || 'anonymous';
    const dir = getSessionDir(sessionId);
    await mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, safeName);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

uploadRouter.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const sessionId = (req as any).sessionId || 'anonymous';
  res.json({
    filename: req.file.filename,
    size: req.file.size,
    download_url: `/api/files/${sessionId}/${req.file.filename}`,
  });
});
