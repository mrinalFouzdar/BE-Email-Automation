import dotenv from 'dotenv';
import { classifyEmailGemini } from './gemini-classifier.service';
import { classifyEmailLocal } from './local-classifier.service';
import { tokenOptimizer } from './token-optimizer.service';

dotenv.config();

export interface ClassificationResult {
  is_hierarchy: boolean;
  is_client: boolean;
  is_meeting: boolean;
  is_escalation: boolean;
  is_urgent: boolean;
  suggested_label: string;
  reasoning: string;
}

// Track Gemini rate limit status
let geminiRateLimited = false;
let rateLimitResetTime: number | null = null;

/**
 * Dynamic LLM classifier with intelligent fallback AND token optimization
 *
 * Optimization Priority:
 * 0. Cache lookup (0 tokens) ⭐ NEW!
 * 1. Domain detection (0 tokens) ⭐ NEW!
 * 2. Regex patterns (0 tokens) ⭐ NEW!
 * 3. Try Gemini LLM (costs tokens, but optimized)
 * 4. Fallback to Local LLM (Ollama)
 * 5. Final fallback: Basic Regex
 */
export async function classifyEmailDynamic(
  subject: string,
  body: string,
  sender: string,
  emailId?: number
): Promise<ClassificationResult> {
  console.log('\n🔍 Starting classification with token optimization...');

  // ========================================
  // STEP 1: Check cache (0 tokens!)
  // ========================================
  const cached = await tokenOptimizer.getCachedClassification(subject, body, sender);
  if (cached) {
    console.log('✅ Using cached result (0 tokens used)');

    // Track cache hit
    if (emailId) {
      await tokenOptimizer.trackTokenUsage(emailId, 'cache', 0, 0);
    }

    return cached;
  }

  // ========================================
  // STEP 2: Progressive classification check
  // ========================================
  const shouldUse = await tokenOptimizer.shouldUseLLM(subject, body, sender);
  console.log(`📊 Classification strategy: ${shouldUse.method} - ${shouldUse.reason}`);

  if (!shouldUse.use_llm) {
    // Use domain or regex classification (0 tokens)
    if (shouldUse.method === 'domain' || shouldUse.method === 'regex') {
      const text = (subject + ' ' + body).toLowerCase();

      // Domain-based classification
      let suggested_label = 'Uncategorized';
      let reasoning = shouldUse.reason;

      if (sender.toLowerCase().includes('medium.com') || sender.toLowerCase().includes('substack.com')) {
        suggested_label = 'Newsletter';
      } else if (sender.toLowerCase().includes('linkedin.com')) {
        suggested_label = 'Social';
      } else if (sender.toLowerCase().includes('amazon.com')) {
        suggested_label = 'Order';
      } else if (text.includes('invoice') || text.includes('receipt')) {
        suggested_label = 'Invoice';
      } else if (text.includes('meeting')) {
        suggested_label = 'Meeting';
      }

      console.log(`✅ ${shouldUse.method.toUpperCase()} classification: ${suggested_label} (0 tokens used)`);

      const result = {
        is_hierarchy: /boss|manager|director|ceo|vp|leadership/i.test(text),
        is_client: /client|customer|vendor|partner/i.test(text),
        is_meeting: /meeting|meet|call|discussion|schedule/i.test(text),
        is_escalation: /escalation|issue|problem|concern|critical/i.test(text),
        is_urgent: /asap|urgent|immediately|deadline|critical/i.test(text),
        suggested_label,
        reasoning,
      };

      // Track domain/regex classification (0 tokens, saved potential LLM call)
      if (emailId) {
        const savedTokens = tokenOptimizer.estimateTokens(subject + body);
        await tokenOptimizer.trackTokenUsage(emailId, shouldUse.method, 0, savedTokens);
      }

      return result;
    }
  }

  // ========================================
  // STEP 3: Optimize email content for LLM
  // ========================================
  const dynamicWindow = tokenOptimizer.getDynamicContextWindow(subject, body);
  const maxTokens = Math.floor(dynamicWindow / 4); // Convert chars to tokens

  const optimized = tokenOptimizer.optimizeEmailContent(subject, body, maxTokens);

  console.log(`📉 Content optimization:`);
  console.log(`   Original: ${optimized.original_length} chars`);
  console.log(`   Optimized: ${optimized.truncated_length} chars`);
  console.log(`   Tokens saved: ~${optimized.tokens_saved}`);

  // ========================================
  // STEP 4: LLM Classification (with optimized content)
  // ========================================
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const useGemini = geminiApiKey && geminiApiKey.trim() !== '';

  // Check if rate limit has expired (reset after 1 minute)
  if (geminiRateLimited && rateLimitResetTime && Date.now() > rateLimitResetTime) {
    console.log('✓ Gemini rate limit reset, trying again');
    geminiRateLimited = false;
    rateLimitResetTime = null;
  }

  // Try Gemini first (if configured and not rate limited)
  if (useGemini && !geminiRateLimited) {
    try {
      const result = await classifyEmailGemini(subject, optimized.body, sender);
      const tokensUsed = tokenOptimizer.estimateTokens(optimized.body);
      console.log(`✅ Gemini classification complete (~${tokensUsed} tokens)`);

      // Track LLM usage with optimization savings
      if (emailId) {
        await tokenOptimizer.trackTokenUsage(emailId, 'llm', tokensUsed, optimized.tokens_saved);
      }

      return result;
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT') {
        geminiRateLimited = true;
        rateLimitResetTime = Date.now() + 60000;
        console.log('⚠️  Gemini rate limited, switching to local LLM');
      } else {
        console.warn('⚠️  Gemini failed, falling back to local LLM:', error.message);
      }
    }
  }

  // Fallback to Local LLM (Ollama) with optimized content
  try {
    const result = await classifyEmailLocal(subject, optimized.body, sender);
    const tokensUsed = tokenOptimizer.estimateTokens(optimized.body);
    console.log(`✅ Local LLM classification complete (~${tokensUsed} tokens)`);

    // Track LLM usage with optimization savings
    if (emailId) {
      await tokenOptimizer.trackTokenUsage(emailId, 'llm', tokensUsed, optimized.tokens_saved);
    }

    return result;
  } catch (error: any) {
    console.warn('⚠️  Local LLM failed, using regex fallback:', error.message);
  }

  // Final fallback: Regex classification
  const text = (subject + ' ' + body).toLowerCase();
  console.log('⚠️  Using final regex fallback (0 tokens)');

  const fallbackResult = {
    is_hierarchy: /boss|manager|director|ceo|vp|leadership/i.test(text),
    is_client: /client|customer|vendor|partner/i.test(text),
    is_meeting: /meeting|meet|call|discussion|schedule/i.test(text),
    is_escalation: /escalation|issue|problem|concern|critical/i.test(text),
    is_urgent: /asap|urgent|immediately|deadline|critical/i.test(text),
    suggested_label: 'Uncategorized',
    reasoning: 'Fallback regex classification (both Gemini and Local LLM failed)',
  };

  // Track fallback (0 tokens used, saved potential LLM call)
  if (emailId) {
    const savedTokens = tokenOptimizer.estimateTokens(subject + body);
    await tokenOptimizer.trackTokenUsage(emailId, 'regex', 0, savedTokens);
  }

  return fallbackResult;
}

/**
 * Get current LLM status
 */
export function getLLMStatus() {
  const geminiConfigured = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
  const ollamaConfigured = !!(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL);

  return {
    gemini: {
      configured: geminiConfigured,
      rateLimited: geminiRateLimited,
      resetTime: rateLimitResetTime,
    },
    ollama: {
      configured: ollamaConfigured,
      baseUrl: process.env.OLLAMA_BASE_URL,
      model: process.env.OLLAMA_MODEL,
    },
    currentProvider: geminiConfigured && !geminiRateLimited ? 'gemini' : 'ollama',
  };
}
