import { Response } from 'express';
import { AuthRequest } from '../types/api.types.js';
import { asyncHandler } from '../utils/asyncHandler.util.js';
import { successResponse } from '../utils/response.util.js';
import { tokenOptimizer } from '../services/ai/token-optimizer.service.js';

export class AnalyticsController {
  /**
   * Get token usage statistics
   * GET /api/v1/analytics/token-usage?days=7
   */
  getTokenUsage = asyncHandler(async (req: AuthRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;

    const stats = await tokenOptimizer.getTokenUsageStats(days);

    if (!stats) {
      return successResponse(res, null, 'No token usage data available', 404);
    }

    return successResponse(res, stats, `Token usage statistics for last ${days} days`);
  });

  /**
   * Get cost savings analysis
   * GET /api/v1/analytics/cost-savings?days=7
   */
  getCostSavings = asyncHandler(async (req: AuthRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;

    const stats = await tokenOptimizer.getTokenUsageStats(days);

    if (!stats) {
      return successResponse(res, null, 'No token usage data available', 404);
    }

    const savings = tokenOptimizer.calculateCostSavings(stats);

    return successResponse(
      res,
      {
        period_days: days,
        ...savings,
        breakdown: stats.by_method,
      },
      `Cost savings analysis for last ${days} days`
    );
  });

  /**
   * Get optimization metrics
   * GET /api/v1/analytics/optimization-metrics?days=7
   */
  getOptimizationMetrics = asyncHandler(async (req: AuthRequest, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;

    const stats = await tokenOptimizer.getTokenUsageStats(days);

    if (!stats) {
      return successResponse(res, null, 'No token usage data available', 404);
    }

    // Calculate optimization rates
    const cacheCount = stats.by_method.cache?.count || 0;
    const domainCount = stats.by_method.domain?.count || 0;
    const regexCount = stats.by_method.regex?.count || 0;
    const llmCount = stats.by_method.llm?.count || 0;

    const totalClassifications = stats.total_classifications;
    const optimizedClassifications = cacheCount + domainCount + regexCount;

    const metrics = {
      period_days: days,
      total_classifications: totalClassifications,
      optimized_classifications: optimizedClassifications,
      llm_classifications: llmCount,
      optimization_rate: totalClassifications > 0
        ? ((optimizedClassifications / totalClassifications) * 100).toFixed(1) + '%'
        : '0%',
      breakdown: {
        cache: {
          count: cacheCount,
          percentage: totalClassifications > 0
            ? ((cacheCount / totalClassifications) * 100).toFixed(1) + '%'
            : '0%',
        },
        domain: {
          count: domainCount,
          percentage: totalClassifications > 0
            ? ((domainCount / totalClassifications) * 100).toFixed(1) + '%'
            : '0%',
        },
        regex: {
          count: regexCount,
          percentage: totalClassifications > 0
            ? ((regexCount / totalClassifications) * 100).toFixed(1) + '%'
            : '0%',
        },
        llm: {
          count: llmCount,
          percentage: totalClassifications > 0
            ? ((llmCount / totalClassifications) * 100).toFixed(1) + '%'
            : '0%',
        },
      },
    };

    return successResponse(res, metrics, `Optimization metrics for last ${days} days`);
  });
}

export const analyticsController = new AnalyticsController();
