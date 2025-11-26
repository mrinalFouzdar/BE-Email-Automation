/**
 * Simple rate limiter utility
 * Adds delay between API calls to prevent rate limit errors
 */

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Rate limiter with configurable delay
 */
export class RateLimiter {
  private lastCallTime: number = 0;
  private delayMs: number;

  constructor(delayMs: number = 1000) {
    this.delayMs = delayMs;
  }

  /**
   * Wait if needed to maintain rate limit
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.delayMs) {
      const waitTime = this.delayMs - timeSinceLastCall;
      await sleep(waitTime);
    }

    this.lastCallTime = Date.now();
  }
}

/**
 * Execute function with retry logic for rate limit errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error
      if (error.status === 429 || error.message?.includes('rate limit')) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`⏳ Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(delay);
        continue;
      }

      // If not a rate limit error, throw immediately
      throw error;
    }
  }

  throw lastError;
}
