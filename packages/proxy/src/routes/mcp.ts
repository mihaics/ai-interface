import { Router } from 'express';
import { processQuery } from '../agent/GisAgent.js';
import type { AgentQueryRequest } from '@ai-interface/shared';

export const mcpRouter = Router();

mcpRouter.post('/query', async (req, res) => {
  try {
    const request = req.body as AgentQueryRequest;

    if (!request.query || !request.context?.session_id) {
      res.status(400).json({ error: 'Missing query or context.session_id' });
      return;
    }

    const response = await processQuery(request);
    res.json(response);
  } catch (error: any) {
    console.error('Agent error:', error);
    res.status(500).json({
      message: 'An error occurred processing your request.',
      error: error.message,
    });
  }
});
