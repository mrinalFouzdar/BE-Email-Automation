import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OllamaEmbeddings, Ollama } from '@langchain/ollama';
import { db } from '../../config/database.config.js';
import { logger } from '../../utils/logger.util.js';

/**
 * Helper function to add delay between retries
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Direct Ollama API call for embeddings with retry logic (bypasses LangChain)
 * Used when LangChain OllamaEmbeddings has connection issues
 */
async function generateOllamaEmbeddingDirect(
  text: string,
  baseUrl: string,
  model: string,
  maxRetries: number = 3
): Promise<number[] | null> {
  // Sanitize text to prevent JSON encoding issues
  const sanitizedText = text
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/\\/g, '\\\\')                // Escape backslashes
    .trim();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: sanitizedText
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (attempt > 1) {
        logger.info(`✓ Direct Ollama API succeeded on retry attempt ${attempt}`);
      }
      return data.embedding;
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        logger.error(`Direct Ollama embedding failed after ${maxRetries} attempts: ${error.message}`);
        return null;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delayMs = 500 * Math.pow(2, attempt - 1);
      logger.warn(`Direct Ollama API attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }

  return null;
}

class EmbeddingService {
  private geminiEmbeddings: GoogleGenerativeAIEmbeddings | null = null;
  private ollamaEmbeddings: OllamaEmbeddings | null = null;
  private useOllamaFallback: boolean = true;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Initialize Gemini (Primary)
    if (apiKey) {
      this.geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: apiKey,
        modelName: 'models/text-embedding-004', // Ensure correct model name
      });
    } else {
      logger.warn('GEMINI_API_KEY not found. Skipping Gemini initialization.');
    }
    
    // Initialize Ollama (Fallback)
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';

    try {
      this.ollamaEmbeddings = new OllamaEmbeddings({
        baseUrl: ollamaBaseUrl,
        model: ollamaModel,
        requestOptions: {
          // Force fetch to use the correct URL
          headers: {
            'Content-Type': 'application/json',
          },
        },
      });
      logger.info(`LangChain Ollama configured: ${ollamaModel} at ${ollamaBaseUrl}`);
    } catch (error) {
      logger.warn('Failed to initialize LangChain Ollama embeddings', error);
      this.useOllamaFallback = false;
    }
  }

  /**
   * Generate embedding using LangChain with automatic failover
   * Returns embedding and the model used to generate it
   * @param text - Text to generate embedding for
   * @param preferLocal - If true, use local embeddings first (for consistency with local classification)
   */
  async generateEmbedding(text: string, preferLocal: boolean = false): Promise<{ embedding: number[], model: string } | null> {
    if (!text || !text.trim()) return null;

    const safeText = text.substring(0, 2000); // Truncate to safe limit for embeddings

    // If preferLocal is true, use Ollama embeddings via LangChain with retry
    if (preferLocal && this.useOllamaFallback && this.ollamaEmbeddings) {
      // Try LangChain Ollama with retry logic
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (attempt === 1) {
            logger.info('Using local Ollama embeddings via LangChain (for consistency with local LLM classification)');
          } else {
            logger.info(`Retrying LangChain Ollama embedding (attempt ${attempt}/${maxRetries})...`);
          }

          const embedding = await this.ollamaEmbeddings.embedQuery(safeText);

          if (embedding && embedding.length > 0) {
            if (attempt > 1) {
              logger.info(`✓ LangChain Ollama succeeded on retry attempt ${attempt}`);
            }
            logger.info(`Generated ${embedding.length}D embedding using local Ollama (LangChain)`);
            return { embedding, model: 'ollama' };
          }
        } catch (error: any) {
          const isLastAttempt = attempt === maxRetries;

          if (isLastAttempt) {
            logger.warn(`LangChain Ollama embedding failed after ${maxRetries} attempts: ${error.message}`);
            break; // Exit retry loop and try direct API
          }

          // Exponential backoff: 500ms, 1000ms, 2000ms
          const delayMs = 500 * Math.pow(2, attempt - 1);
          logger.warn(`LangChain Ollama attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`);
          await delay(delayMs);
        }
      }

      // If LangChain failed after retries, try direct API as fallback
      logger.info('Trying direct Ollama API as fallback...');
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
      const embedding = await generateOllamaEmbeddingDirect(safeText, ollamaBaseUrl, ollamaModel);

      if (embedding && embedding.length > 0) {
        logger.info(`Generated ${embedding.length}D embedding using direct Ollama API (fallback)`);
        return { embedding, model: 'ollama' };
      } else {
        logger.warn('Direct Ollama API also failed, trying Gemini...');
      }
    }

    // 1. Try Gemini (if not preferLocal or local failed)
    if (this.geminiEmbeddings) {
      try {
        const embedding = await this.geminiEmbeddings.embedQuery(safeText);
        if (embedding && embedding.length > 0) {
          logger.debug('Generated embedding using LangChain: Gemini');
          return { embedding, model: 'gemini' };
        }
      } catch (error: any) {
        logger.warn(`Gemini embedding failed: ${error.message}`);
      }
    }

    // 2. Fallback to Ollama (if not already tried)
    if (!preferLocal && this.useOllamaFallback && this.ollamaEmbeddings) {
      try {
        logger.info('Attempting failover to Ollama...');
        const embedding = await this.ollamaEmbeddings.embedQuery(safeText);
        if (embedding && embedding.length > 0) {
          logger.info('Generated embedding using LangChain: Ollama Fallback');
          return { embedding, model: 'ollama' };
        }
      } catch (error: any) {
        logger.error(`Ollama embedding fallback failed: ${error.message}`);
      }
    }

    logger.error('All embedding generation methods failed.');
    return null;
  }

  /**
   * Store embedding for an email with model tracking
   */
  async storeEmailEmbedding(emailId: number, embedding: number[], model: string): Promise<void> {
    try {
      // Format embedding as vector string for pgvector: '[1,2,3]'
      const embeddingStr = `[${embedding.join(',')}]`;

      const query = `
        UPDATE email_meta
        SET embedding = $1::vector, embedding_model = $2
        WHERE email_id = $3
      `;

      await db.query(query, [embeddingStr, model, emailId]);
      logger.info(`Stored ${embedding.length}D ${model} embedding for email ${emailId}`);
    } catch (error) {
      logger.error(`Error storing embedding for email ${emailId}:`, error);
      throw error;
    }
  }

  /**
   * Check embedding model consistency across database
   */
  async checkModelConsistency(): Promise<{ models: string[], count: Record<string, number>, warning: string | null }> {
    try {
      const query = `
        SELECT embedding_model, COUNT(*) as count
        FROM email_meta
        WHERE embedding IS NOT NULL AND embedding_model IS NOT NULL
        GROUP BY embedding_model
      `;

      const result = await db.query(query);
      const models = result.rows.map(r => r.embedding_model);
      const count: Record<string, number> = {};

      result.rows.forEach(row => {
        count[row.embedding_model] = parseInt(row.count);
      });

      let warning = null;
      if (models.length > 1) {
        warning = `⚠️  WARNING: Multiple embedding models detected (${models.join(', ')}). Similarity searches may be inaccurate!`;
      }

      return { models, count, warning };
    } catch (error) {
      logger.error('Error checking model consistency:', error);
      return { models: [], count: {}, warning: null };
    }
  }

  /**
   * Find similar emails based on embedding (only compares same-model embeddings)
   */
  async findSimilarEmails(embedding: number[], embeddingModel: string, limit = 5, threshold = 0.7): Promise<any[]> {
    try {
      const embeddingStr = `[${embedding.join(',')}]`;
      const distanceThreshold = 1 - threshold;

      const query = `
        SELECT
          e.id,
          e.subject,
          e.body,
          em.embedding_model,
          em.embedding <=> $1::vector as distance,
          (1 - (em.embedding <=> $1::vector)) as similarity
        FROM email_meta em
        JOIN emails e ON e.id = em.email_id
        WHERE em.embedding IS NOT NULL
        AND em.embedding_model = $2
        AND (em.embedding <=> $1::vector) < $3
        ORDER BY distance ASC
        LIMIT $4
      `;

      const result = await db.query(query, [embeddingStr, embeddingModel, distanceThreshold, limit]);
      logger.info(`Found ${result.rows.length} similar emails using ${embeddingModel} model`);
      return result.rows;
    } catch (error) {
      logger.error('Error finding similar emails:', error);
      return [];
    }
  }

  /**
   * Update label embedding (centroid)
   */
  async updateLabelEmbedding(labelId: number, newEmbedding: number[]): Promise<void> {
    try {
      const embeddingStr = `[${newEmbedding.join(',')}]`;

      // Check if label embedding exists
      const checkQuery = `SELECT * FROM label_embeddings WHERE label_id = $1`;
      const checkResult = await db.query(checkQuery, [labelId]);

      if (checkResult.rows.length === 0) {
        // First email for this label, just insert
        const insertQuery = `
          INSERT INTO label_embeddings (label_id, embedding, email_count)
          VALUES ($1, $2::vector, 1)
        `;
        await db.query(insertQuery, [labelId, embeddingStr]);
      } else {
        // Update existing centroid
        const updateQuery = `
          UPDATE label_embeddings
          SET 
            embedding = (embedding * email_count + $2::vector) / (email_count + 1),
            email_count = email_count + 1,
            last_updated = CURRENT_TIMESTAMP
          WHERE label_id = $1
        `;
        await db.query(updateQuery, [labelId, embeddingStr]);
      }
    } catch (error) {
      logger.error(`Error updating label embedding for label ${labelId}:`, error);
    }
  }

  /**
   * Get suggested labels based on similarity to label centroids
   */
  async suggestLabelsFromEmbeddings(embedding: number[], limit = 3): Promise<any[]> {
    try {
      const embeddingStr = `[${embedding.join(',')}]`;

      const query = `
        SELECT 
          l.name, 
          l.id,
          (1 - (le.embedding <=> $1::vector)) as similarity
        FROM label_embeddings le
        JOIN labels l ON l.id = le.label_id
        ORDER BY similarity DESC
        LIMIT $2
      `;

      const result = await db.query(query, [embeddingStr, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error suggesting labels from embeddings:', error);
      return [];
    }
  }
}

export const embeddingService = new EmbeddingService();
