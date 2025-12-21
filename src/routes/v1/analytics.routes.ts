import { Router } from 'express';
import { analyticsController } from '../../controllers/analytics.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route   GET /api/v1/analytics/token-usage
 * @desc    Get token usage statistics
 * @access  Private (requires authentication)
 * @query   days - Number of days to analyze (default: 7)
 */
router.get('/token-usage', authenticate, analyticsController.getTokenUsage);

/**
 * @route   GET /api/v1/analytics/cost-savings
 * @desc    Get cost savings analysis
 * @access  Private (requires authentication)
 * @query   days - Number of days to analyze (default: 7)
 */
router.get('/cost-savings', authenticate, analyticsController.getCostSavings);

/**
 * @route   GET /api/v1/analytics/optimization-metrics
 * @desc    Get optimization metrics (cache hit rate, domain detection, etc.)
 * @access  Private (requires authentication)
 * @query   days - Number of days to analyze (default: 7)
 */
router.get('/optimization-metrics', authenticate, analyticsController.getOptimizationMetrics);

export default router;
