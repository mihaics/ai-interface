import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import { sessionRouter } from './routes/session.js';
import { mcpRouter } from './routes/mcp.js';
import { uploadRouter } from './routes/upload.js';
import { fetchPdfRouter } from './routes/fetchPdf.js';
import { filesRouter } from './routes/files.js';
import { validateSession } from './middleware/validateSession.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Session creation (no auth required)
app.use('/api', sessionRouter);

// Protected routes require valid session token
app.use('/api/mcp', validateSession, rateLimit);

// MCP agent endpoint
app.use('/api/mcp', mcpRouter);

// File upload (protected, under MCP path)
app.use('/api/mcp', uploadRouter);

// PDF proxy (protected, under MCP path)
app.use('/api/mcp', fetchPdfRouter);

// File download (public, file path is the auth)
app.use('/api', filesRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orchestration proxy running on port ${PORT}`);
});

export { app };
