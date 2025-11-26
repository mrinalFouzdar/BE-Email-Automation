import dotenv from 'dotenv';
import { classifyEmailGemini } from './gemini-classifier.service';
import { classifyEmailLocal } from './local-classifier.service';

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
 * Dynamic LLM classifier with intelligent fallback
 *
 * Priority:
 * 1. Try Gemini (if API key present and not rate limited)
 * 2. Fallback to Local LLM (Ollama)
 * 3. Fallback to Regex (if both fail)
 */
export async function classifyEmailDynamic(
  subject: string,
  body: string,
  sender: string
): Promise<ClassificationResult> {
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
      const result = await classifyEmailGemini(subject, body, sender);
      return result;
    } catch (error: any) {
      if (error.message === 'RATE_LIMIT') {
        // Mark as rate limited and set reset time (1 minute)
        geminiRateLimited = true;
        rateLimitResetTime = Date.now() + 60000; // 1 minute
        console.log('⚠️  Gemini rate limited, switching to local LLM');
      } else {
        console.warn('⚠️  Gemini failed, falling back to local LLM:', error.message);
      }
    }
  }

  // Fallback to Local LLM (Ollama)
  try {
    const result = await classifyEmailLocal(subject, body, sender);
    return result;
  } catch (error: any) {
    console.warn('⚠️  Local LLM failed, using regex fallback:', error.message);
  }

  // Final fallback: Regex classification
  const text = (subject + ' ' + body).toLowerCase();
  return {
    is_hierarchy: /boss|manager|director|ceo|vp|leadership/i.test(text),
    is_client: /client|customer|vendor|partner/i.test(text),
    is_meeting: /meeting|meet|call|discussion|schedule/i.test(text),
    is_escalation: /escalation|issue|problem|concern|critical/i.test(text),
    is_urgent: /asap|urgent|immediately|deadline|critical/i.test(text),
    suggested_label: 'Uncategorized',
    reasoning: 'Fallback regex classification (both Gemini and Local LLM failed)',
  };
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
