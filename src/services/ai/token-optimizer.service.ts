import crypto from 'crypto';
import { client, ensureConnected } from '../../config/db.js';

/**
 * Token Optimization Service
 *
 * Reduces LLM token usage through:
 * 1. Classification result caching
 * 2. Smart email body truncation
 * 3. Progressive classification (domain → regex → LLM)
 * 4. Dynamic context window
 * 5. Token usage tracking
 */

export interface TokenUsageStats {
  estimated_tokens: number;
  cache_hit: boolean;
  method_used: 'cache' | 'domain' | 'regex' | 'llm';
  tokens_saved: number;
}

export interface OptimizedEmailContent {
  subject: string;
  body: string;
  original_length: number;
  truncated_length: number;
  tokens_saved: number;
}

/**
 * Generate cache key for email classification
 */
function generateCacheKey(subject: string, body: string, sender: string): string {
  const content = `${subject}|${body.substring(0, 5000)}|${sender}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if classification result is cached
 */
export async function getCachedClassification(
  subject: string,
  body: string,
  sender: string
): Promise<any | null> {
  try {
    await ensureConnected();

    const cacheKey = generateCacheKey(subject, body, sender);

    // Check if we have a recent classification for this exact email
    const query = `
      SELECT
        em.classification,
        e.created_at
      FROM email_meta em
      JOIN emails e ON e.id = em.email_id
      WHERE e.subject = $1
        AND e.sender = $2
        AND em.classification IS NOT NULL
        AND e.created_at > NOW() - INTERVAL '30 days'
      ORDER BY e.created_at DESC
      LIMIT 1;
    `;

    const result = await client.query(query, [subject, sender]);

    if (result.rows.length > 0) {
      console.log('✓ Cache HIT: Using cached classification');
      return result.rows[0].classification;
    }

    return null;
  } catch (error) {
    console.log('Cache lookup failed:', error);
    return null;
  }
}

/**
 * Smart email body truncation
 * Keeps important parts while reducing token usage
 */
export function optimizeEmailContent(
  subject: string,
  body: string,
  maxTokens: number = 500
): OptimizedEmailContent {
  const originalLength = body.length;
  const maxChars = maxTokens * 4; // Rough conversion

  if (body.length <= maxChars) {
    return {
      subject,
      body,
      original_length: originalLength,
      truncated_length: body.length,
      tokens_saved: 0,
    };
  }

  // Smart truncation strategy:
  // 1. Take first 60% of content (usually contains main message)
  // 2. Take last 20% (often contains signature/action items)
  // 3. Skip middle 20% (usually quoted text, disclaimers)

  const firstPart = Math.floor(maxChars * 0.6);
  const lastPart = Math.floor(maxChars * 0.2);

  const beginning = body.substring(0, firstPart);
  const ending = body.substring(body.length - lastPart);

  const optimizedBody = `${beginning}\n\n[... content truncated for optimization ...]\n\n${ending}`;

  const tokensSaved = estimateTokens(body) - estimateTokens(optimizedBody);

  console.log(`📉 Token optimization: ${originalLength} → ${optimizedBody.length} chars (saved ~${tokensSaved} tokens)`);

  return {
    subject,
    body: optimizedBody,
    original_length: originalLength,
    truncated_length: optimizedBody.length,
    tokens_saved: tokensSaved,
  };
}

/**
 * Progressive classification: Try cheaper methods first
 *
 * Priority:
 * 1. Cache lookup (0 tokens)
 * 2. Domain detection (0 tokens)
 * 3. Regex patterns (0 tokens)
 * 4. LLM classification (costs tokens)
 */
export async function shouldUseLLM(
  subject: string,
  body: string,
  sender: string
): Promise<{ use_llm: boolean; reason: string; method: string }> {
  // 1. Check cache
  const cached = await getCachedClassification(subject, body, sender);
  if (cached) {
    return {
      use_llm: false,
      reason: 'Classification found in cache (30-day window)',
      method: 'cache',
    };
  }

  // 2. Check domain detection confidence
  const domainPatterns = [
    'medium.com',
    'substack.com',
    'linkedin.com',
    'amazon.com',
    'github.com',
  ];

  const hasClearDomain = domainPatterns.some((pattern) => sender.toLowerCase().includes(pattern));

  if (hasClearDomain) {
    // For well-known domains, we can skip LLM if the pattern is clear
    const text = (subject + ' ' + body).toLowerCase();

    // Newsletter patterns
    if (
      (sender.includes('medium.com') || sender.includes('substack.com')) &&
      (text.includes('digest') || text.includes('newsletter') || text.includes('weekly'))
    ) {
      return {
        use_llm: false,
        reason: 'Clear newsletter pattern detected (domain + keywords)',
        method: 'domain',
      };
    }

    // Social patterns
    if (sender.includes('linkedin.com') && text.includes('connection')) {
      return {
        use_llm: false,
        reason: 'Clear social pattern detected',
        method: 'domain',
      };
    }

    // E-commerce patterns
    if (
      (sender.includes('amazon.com') || sender.includes('ebay.com')) &&
      (text.includes('order') || text.includes('shipped') || text.includes('delivery'))
    ) {
      return {
        use_llm: false,
        reason: 'Clear e-commerce pattern detected',
        method: 'domain',
      };
    }
  }

  // 3. Check regex patterns for clear cases
  const text = (subject + ' ' + body).toLowerCase();

  // Very clear invoice pattern
  if (
    (subject.toLowerCase().includes('invoice') || subject.toLowerCase().includes('receipt')) &&
    (text.includes('total') || text.includes('amount due') || text.includes('payment'))
  ) {
    return {
      use_llm: false,
      reason: 'Clear invoice/receipt pattern detected',
      method: 'regex',
    };
  }

  // Very clear meeting pattern
  if (
    (subject.toLowerCase().includes('meeting') || subject.toLowerCase().includes('call')) &&
    (text.includes('zoom') || text.includes('teams') || text.includes('calendar') || text.includes('agenda'))
  ) {
    return {
      use_llm: false,
      reason: 'Clear meeting pattern detected',
      method: 'regex',
    };
  }

  // 4. Use LLM for uncertain cases
  return {
    use_llm: true,
    reason: 'No clear pattern detected, using LLM for accurate classification',
    method: 'llm',
  };
}

/**
 * Dynamic context window based on email complexity
 */
export function getDynamicContextWindow(subject: string, body: string): number {
  const text = subject + ' ' + body;

  // Simple email: newsletter, notification, automated
  const simplePatterns = [
    'newsletter',
    'digest',
    'notification',
    'no-reply',
    'automated',
    'unsubscribe',
  ];

  const isSimple = simplePatterns.some((pattern) => text.toLowerCase().includes(pattern));

  if (isSimple) {
    return 1000; // 250 tokens (small window for simple emails)
  }

  // Medium complexity: general work emails
  if (body.length < 2000) {
    return 2000; // 500 tokens
  }

  // Complex: long emails, threads, detailed content
  return 3000; // 750 tokens (max window)
}

/**
 * Track token usage for analytics
 */
export async function trackTokenUsage(
  email_id: number,
  method: string,
  estimated_tokens: number,
  tokens_saved: number
): Promise<void> {
  try {
    await ensureConnected();

    const query = `
      INSERT INTO token_usage_stats (
        email_id,
        classification_method,
        estimated_tokens,
        tokens_saved,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (email_id)
      DO UPDATE SET
        classification_method = $2,
        estimated_tokens = $3,
        tokens_saved = $4,
        created_at = NOW();
    `;

    await client.query(query, [email_id, method, estimated_tokens, tokens_saved]);
  } catch (error) {
    // Token tracking is optional, don't fail classification if it errors
    console.log('Token tracking failed (non-critical):', error);
  }
}

/**
 * Get token usage statistics
 */
export async function getTokenUsageStats(days: number = 7): Promise<any> {
  try {
    await ensureConnected();

    const query = `
      SELECT
        classification_method,
        COUNT(*) as count,
        SUM(estimated_tokens) as total_tokens,
        SUM(tokens_saved) as total_saved,
        AVG(estimated_tokens) as avg_tokens
      FROM token_usage_stats
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY classification_method
      ORDER BY count DESC;
    `;

    const result = await client.query(query);

    const summary = {
      period_days: days,
      total_classifications: 0,
      total_tokens_used: 0,
      total_tokens_saved: 0,
      by_method: {} as any,
    };

    result.rows.forEach((row) => {
      summary.total_classifications += parseInt(row.count);
      summary.total_tokens_used += parseInt(row.total_tokens || 0);
      summary.total_tokens_saved += parseInt(row.total_saved || 0);

      summary.by_method[row.classification_method] = {
        count: parseInt(row.count),
        total_tokens: parseInt(row.total_tokens || 0),
        total_saved: parseInt(row.total_saved || 0),
        avg_tokens: parseFloat(row.avg_tokens || 0).toFixed(0),
      };
    });

    return summary;
  } catch (error) {
    console.error('Error getting token usage stats:', error);
    return null;
  }
}

/**
 * Batch classification helper (process multiple emails efficiently)
 */
export function batchEmails(emails: any[], batchSize: number = 5): any[][] {
  const batches = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Calculate cost savings
 */
export function calculateCostSavings(tokenStats: any): any {
  // Gemini Flash pricing: ~$0.075 per 1M input tokens
  const COST_PER_1M_TOKENS = 0.075;

  const tokensUsed = tokenStats.total_tokens_used || 0;
  const tokensSaved = tokenStats.total_tokens_saved || 0;

  const costUsed = (tokensUsed / 1000000) * COST_PER_1M_TOKENS;
  const costSaved = (tokensSaved / 1000000) * COST_PER_1M_TOKENS;

  return {
    tokens_used: tokensUsed,
    tokens_saved: tokensSaved,
    cost_used_usd: costUsed.toFixed(4),
    cost_saved_usd: costSaved.toFixed(4),
    savings_percentage: tokensSaved > 0 ? ((tokensSaved / (tokensUsed + tokensSaved)) * 100).toFixed(1) : '0',
  };
}

export const tokenOptimizer = {
  getCachedClassification,
  optimizeEmailContent,
  shouldUseLLM,
  getDynamicContextWindow,
  trackTokenUsage,
  getTokenUsageStats,
  batchEmails,
  calculateCostSavings,
  estimateTokens,
};
