import express from 'express';
import cors from 'cors';
import { sessionRouter } from './routes/session.js';
import { mcpRouter } from './routes/mcp.js';
import { validateSession } from './middleware/validateSession.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
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

app.listen(PORT, () => {
  console.log(`Orchestration proxy running on port ${PORT}`);
});

export { app };
