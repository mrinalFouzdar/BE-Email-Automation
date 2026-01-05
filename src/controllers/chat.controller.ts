import { Request, Response } from 'express';
import { embeddingService } from '../services/ai/embedding.service.js';
import { pdfProcessingService } from '../services/pdf/pdf-processing.service.js';
import { db } from '../config/database.config.js';
import { logger } from '../utils/logger.util.js';
import { Ollama } from '@langchain/ollama';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

/**
 * RAG Chat Controller
 * Handles AI-based chat queries using Retrieval-Augmented Generation
 */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  question: string;
  conversationHistory?: ChatMessage[];
  useLocalLLM?: boolean;
  searchThreshold?: number;
  maxResults?: number;
  userId?: number; // Filter by specific user's emails
}

interface SearchResult {
  type: 'email' | 'pdf';
  id: number;
  emailId: number;
  subject: string;
  content: string;
  source: string;
  date: string;
  similarity: number;
  filename?: string;
}

class ChatController {
  private ollamaLLM: Ollama | null = null;
  private geminiLLM: ChatGoogleGenerativeAI | null = null;

  constructor() {
    // Initialize Ollama
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';

    try {
      this.ollamaLLM = new Ollama({
        baseUrl: ollamaBaseUrl,
        model: ollamaModel,
      });
      logger.info(`Ollama LLM initialized: ${ollamaModel} at ${ollamaBaseUrl}`);
    } catch (error) {
      logger.warn('Failed to initialize Ollama LLM', error);
    }

    // Initialize Gemini with LangChain
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      this.geminiLLM = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash-exp',
        maxOutputTokens: 2048,
        apiKey: geminiApiKey,
      });
      logger.info('Gemini LLM initialized with LangChain (gemini-2.0-flash-exp)');
    } else {
      logger.warn('GEMINI_API_KEY not found. Gemini LLM not available.');
    }
  }

  /**
   * Main chat endpoint
   */
  async chat(req: Request, res: Response) {
    try {
      const {
        question,
        conversationHistory = [],
        useLocalLLM = false,
        searchThreshold = 0.3, // Lowered from 0.5 to 0.3 for better recall
        maxResults = 5,
        userId,
      }: ChatRequest = req.body;

      if (!question || question.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Question is required',
        });
      }

      logger.info(`Received chat question: "${question}"`);

      // Step 1: Generate embedding for the question
      const embeddingResult = await embeddingService.generateEmbedding(
        question,
        useLocalLLM
      );

      if (!embeddingResult) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate embedding for the question',
        });
      }

      const { embedding, model: embeddingModel } = embeddingResult;

      // Step 2: Hybrid Search (Try both Gemini and Ollama if available)
      let allSearchResults: SearchResult[] = [];
      const usedModels = new Set<string>();

      // 2a. Search using the primary embedding
      if (embeddingResult) {
        usedModels.add(embeddingResult.model);
        const results = await this.searchRelevantContent(
          embeddingResult.embedding,
          embeddingResult.model,
          maxResults,
          searchThreshold,
          userId
        );
        allSearchResults = [...allSearchResults, ...results];
      }

      // 2b. Attempt to generate and search with the "other" model
      const otherModel = embeddingResult.model === 'gemini' ? 'ollama' : 'gemini';
      
      // Check if we should try the other model
      let shouldTryOther = false;
      if (otherModel === 'gemini' && this.geminiLLM) shouldTryOther = true;
      if (otherModel === 'ollama' && this.ollamaLLM) shouldTryOther = true;

      if (shouldTryOther) {
        logger.info(`Attempting hybrid search with secondary model: ${otherModel}`);
        const secondaryEmbedding = await embeddingService.generateEmbeddingForModel(question, otherModel);
        
        if (secondaryEmbedding) {
           usedModels.add(secondaryEmbedding.model);
           const secondaryResults = await this.searchRelevantContent(
            secondaryEmbedding.embedding,
            secondaryEmbedding.model,
            maxResults,
            searchThreshold,
            userId
          );
          allSearchResults = [...allSearchResults, ...secondaryResults];
        }
      }

      // Step 3: Deduplicate and sort combined results
      // Sort by similarity DESC
      allSearchResults.sort((a, b) => b.similarity - a.similarity);

      // Deduplicate by ID and Type (keep highest similarity)
      const seen = new Set<string>();
      const uniqueResults: SearchResult[] = [];
      
      for (const r of allSearchResults) {
        const key = `${r.type}-${r.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(r);
        }
      }
      
      // Slice to max results
      const finalResults = uniqueResults.slice(0, maxResults);

      if (finalResults.length === 0) {
        return res.json({
          success: true,
          answer: "I couldn't find any relevant information in your emails or documents to answer this question.",
          sources: [],
          conversationHistory,
        });
      }

      // Step 4: Build context from search results
      const context = this.buildContext(finalResults);

      // Step 5: Generate answer using LLM
      const answer = await this.generateAnswer(
        question,
        context,
        conversationHistory,
        useLocalLLM
      );

      // Step 6: Return response
      return res.json({
        success: true,
        answer,
        sources: finalResults.map((r) => ({
          type: r.type,
          subject: r.subject,
          source: r.source,
          date: r.date,
          similarity: r.similarity,
          filename: r.filename,
        })),
        conversationHistory: [
          ...conversationHistory,
          { role: 'user', content: question },
          { role: 'assistant', content: answer },
        ],
      });
    } catch (error: any) {
      logger.error('Chat error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'An error occurred during chat processing',
      });
    }
  }

  /**
   * Search for relevant content in emails and PDFs
   */
  private async searchRelevantContent(
    embedding: number[],
    embeddingModel: string,
    maxResults: number,
    threshold: number,
    userId?: number
  ): Promise<SearchResult[]> {
    try {
      const embeddingStr = `[${embedding.join(',')}]`;
      const distanceThreshold = 1 - threshold;

      // Build user filter if userId is provided
      const userFilter = userId ? 'AND ea.user_id = $5' : '';
      const emailUserFilter = userId ? 'AND e.account_id IN (SELECT id FROM email_accounts WHERE user_id = $5)' : '';

      const params: any[] = [
        embeddingStr,
        embeddingModel,
        distanceThreshold,
        maxResults,
      ];

      if (userId) {
        params.push(userId);
      }

      const query = `
        WITH email_results AS (
          SELECT
            'email' as type,
            e.id,
            e.id as email_id,
            e.subject,
            e.body as content,
            e.sender_email as source,
            e.received_at::text as date,
            em.embedding <=> $1::vector as distance,
            (1 - (em.embedding <=> $1::vector)) as similarity,
            NULL as filename
          FROM email_meta em
          JOIN emails e ON e.id = em.email_id
          WHERE em.embedding IS NOT NULL
            AND em.embedding_model = $2
            AND (em.embedding <=> $1::vector) < $3
            ${emailUserFilter}
        ),
        pdf_results AS (
          SELECT
            'pdf' as type,
            ea.id,
            ea.email_id,
            e.subject,
            ea.content,
            e.sender_email as source,
            e.received_at::text as date,
            ea.embedding <=> $1::vector as distance,
            (1 - (ea.embedding <=> $1::vector)) as similarity,
            ea.filename
          FROM email_attachments ea
          JOIN emails e ON e.id = ea.email_id
          WHERE ea.embedding IS NOT NULL
            AND ea.embedding_model = $2
            AND (ea.embedding <=> $1::vector) < $3
            ${emailUserFilter}
        )
        SELECT * FROM (
          SELECT * FROM email_results
          UNION ALL
          SELECT * FROM pdf_results
        ) combined
        ORDER BY similarity DESC
        LIMIT $4
      `;

      const result = await db.query(query, params);

      logger.info(
        `Found ${result.rows.length} relevant documents (threshold: ${threshold})`
      );
      return result.rows;
    } catch (error: any) {
      logger.error('Error searching relevant content:', error);
      return [];
    }
  }

  /**
   * Build context string from search results
   */
  private buildContext(results: SearchResult[]): string {
    let context = 'Here is the relevant information from emails and documents:\n\n';

    results.forEach((result, index) => {
      const sourceType = result.type === 'pdf' ? 'PDF Document' : 'Email';
      context += `--- ${sourceType} ${index + 1} (Similarity: ${(result.similarity * 100).toFixed(1)}%) ---\n`;
      context += `Subject: ${result.subject}\n`;
      if (result.filename) {
        context += `Filename: ${result.filename}\n`;
      }
      context += `From: ${result.source}\n`;
      context += `Date: ${result.date}\n`;
      context += `Content: ${result.content.substring(0, 1000)}...\n\n`;
    });

    return context;
  }

  /**
   * Generate answer using LLM with RAG
   */
  private async generateAnswer(
    question: string,
    context: string,
    conversationHistory: ChatMessage[],
    useLocalLLM: boolean
  ): Promise<string> {
    const systemPrompt = `You are an AI assistant that helps users find information in their emails and documents.
Use the provided context to answer questions accurately. If the context doesn't contain enough information, say so clearly.
Always cite which email or document you're referencing when answering.
Be concise and helpful.`;

    const userPrompt = `${context}

Question: ${question}

Please provide a helpful answer based on the context above.`;

    try {
      if (useLocalLLM && this.ollamaLLM) {
        logger.info('Using Ollama LLM for answer generation');
        const response = await this.ollamaLLM.invoke(
          `${systemPrompt}\n\n${userPrompt}`
        );
        return response;
      } else if (this.geminiLLM) {
        try {
          logger.info('Using Gemini LLM for answer generation (LangChain)');
          const response = await this.geminiLLM.invoke(
            `${systemPrompt}\n\n${userPrompt}`
          );
          return response.content as string;
        } catch (geminiError: any) {
          logger.warn(`Gemini LLM failed: ${geminiError.message}. Falling back to Ollama...`);

          // Fallback to Ollama if Gemini fails
          if (this.ollamaLLM) {
            logger.info('Using Ollama LLM as fallback');
            const response = await this.ollamaLLM.invoke(
              `${systemPrompt}\n\n${userPrompt}`
            );
            return response;
          } else {
            throw new Error(`Gemini failed and no Ollama LLM available: ${geminiError.message}`);
          }
        }
      } else {
        throw new Error('No LLM available for answer generation');
      }
    } catch (error: any) {
      logger.error('Error generating answer:', error);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * Get chat history for a user (optional - for future implementation)
   */
  async getChatHistory(req: Request, res: Response) {
    try {
      // TODO: Implement chat history storage and retrieval
      return res.json({
        success: true,
        history: [],
      });
    } catch (error: any) {
      logger.error('Error fetching chat history:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const chatController = new ChatController();
