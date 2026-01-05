import { createRequire } from 'module';
import { logger } from '../../utils/logger.util.js';
import { embeddingService } from '../ai/embedding.service.js';
import { db } from '../../config/database.config.js';

// Import pdf-parse v1.1.1 using require (CommonJS module)
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export interface PDFAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

export interface ProcessedPDF {
  filename: string;
  contentType: string;
  text: string;
  fileSize: number;
}

/**
 * PDF Processing Service
 * Handles extraction of text from PDF attachments
 */
class PDFProcessingService {
  /**
   * Extract text from PDF buffer
   */
  async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      const data = await pdf(pdfBuffer);
      return data.text;
    } catch (error: any) {
      logger.error('Error extracting text from PDF:', error);
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Process a single PDF attachment
   */
  async processPDFAttachment(attachment: PDFAttachment): Promise<ProcessedPDF> {
    try {
      logger.info(`Processing PDF: ${attachment.filename}`);

      const text = await this.extractTextFromPDF(attachment.content);
      const cleanText = this.cleanText(text);

      logger.info(`Extracted ${cleanText.length} characters from ${attachment.filename}`);

      return {
        filename: attachment.filename,
        contentType: attachment.contentType,
        text: cleanText,
        fileSize: attachment.content.length,
      };
    } catch (error: any) {
      logger.error(`Error processing PDF ${attachment.filename}:`, error);
      throw error;
    }
  }

  /**
   * Clean extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .trim();
  }

  /**
   * Store PDF attachment in database with embedding
   */
  async storePDFAttachment(
    emailId: number,
    processedPDF: ProcessedPDF,
    rawData?: Buffer
  ): Promise<number> {
    try {
      // Generate embedding for the PDF content (use system default preference, do not force local)
      const result = await embeddingService.generateEmbedding(processedPDF.text);

      if (!result) {
        logger.warn(`No embedding generated for PDF ${processedPDF.filename}`);
      }

      const embedding = result?.embedding || null;
      const embeddingModel = result?.model || null;
      const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

      // Insert PDF attachment into database
      const query = `
        INSERT INTO email_attachments (
          email_id,
          filename,
          content_type,
          file_size,
          content,
          raw_data,
          embedding,
          embedding_model
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)
        RETURNING id
      `;

      const values = [
        emailId,
        processedPDF.filename,
        processedPDF.contentType,
        processedPDF.fileSize,
        processedPDF.text,
        rawData || null,
        embeddingStr,
        embeddingModel,
      ];

      const dbResult = await db.query(query, values);
      const attachmentId = dbResult.rows[0].id;

      logger.info(`Stored PDF attachment ${processedPDF.filename} with ID ${attachmentId}`);
      return attachmentId;
    } catch (error: any) {
      logger.error('Error storing PDF attachment:', error);
      throw error;
    }
  }

  /**
   * Get all PDF attachments for an email
   */
  async getPDFAttachmentsByEmailId(emailId: number): Promise<any[]> {
    try {
      const query = `
        SELECT
          id,
          filename,
          content_type,
          file_size,
          content,
          embedding_model,
          created_at
        FROM email_attachments
        WHERE email_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [emailId]);
      return result.rows;
    } catch (error: any) {
      logger.error(`Error fetching PDF attachments for email ${emailId}:`, error);
      return [];
    }
  }

  /**
   * Search similar PDF content using vector similarity
   */
  async searchSimilarPDFContent(
    queryEmbedding: number[],
    embeddingModel: string,
    limit = 5,
    threshold = 0.7
  ): Promise<any[]> {
    try {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const distanceThreshold = 1 - threshold;

      const query = `
        SELECT
          ea.id,
          ea.filename,
          ea.content,
          ea.email_id,
          e.subject as email_subject,
          e.sender_email,
          e.received_at,
          ea.embedding <=> $1::vector as distance,
          (1 - (ea.embedding <=> $1::vector)) as similarity
        FROM email_attachments ea
        JOIN emails e ON e.id = ea.email_id
        WHERE ea.embedding IS NOT NULL
        AND ea.embedding_model = $2
        AND (ea.embedding <=> $1::vector) < $3
        ORDER BY distance ASC
        LIMIT $4
      `;

      const result = await db.query(query, [
        embeddingStr,
        embeddingModel,
        distanceThreshold,
        limit,
      ]);

      logger.info(`Found ${result.rows.length} similar PDF documents`);
      return result.rows;
    } catch (error: any) {
      logger.error('Error searching similar PDF content:', error);
      return [];
    }
  }
}

export const pdfProcessingService = new PDFProcessingService();
