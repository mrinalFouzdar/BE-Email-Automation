import { Router } from 'express';
import v1Routes from './v1';

const router = Router();

// API versioning
router.use('/v1', v1Routes);

// Default route - redirect to v1
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Email RAG API',
    version: 'v1',
    endpoints: {
      v1: '/api/v1',
      health: '/api/v1/health',
      docs: '/api-docs',
    },
  });
});

export default router;
