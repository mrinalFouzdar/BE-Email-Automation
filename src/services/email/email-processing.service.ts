import { client } from '../../config/db.js';
import { EmailClassifierAgent } from '../../modules/extension/langchain.service.js';
import { EmailLabelAssignmentService } from './email-label-assignment.service.js';
import type { ClassificationResult } from '../ai/ai.types.js';
import { embeddingService } from '../ai/embedding.service.js';
import { cleanEmailContent, cleanEmailSubject } from '../../utils/email-cleaner.util.js';

export class EmailProcessingService {
  private classifierAgent: EmailClassifierAgent;
  private labelAssignmentService: EmailLabelAssignmentService;

  constructor() {
    this.classifierAgent = new EmailClassifierAgent();
    this.labelAssignmentService = new EmailLabelAssignmentService();
  }

  /**
   * Process a single email: Classify, Embed, Assign Labels
   */
  async processEmail(emailId: number, dbClient?: any): Promise<void> {
    const db = dbClient || client;
    try {
      console.log(`⚙️ Processing email ${emailId}...`);

      // 1. Fetch email data
      const emailResult = await db.query('SELECT * FROM emails WHERE id = $1', [emailId]);
      if (emailResult.rows.length === 0) {
        console.error(`Email ${emailId} not found`);
        return;
      }
      const email = emailResult.rows[0];

      // Clean email content for LLM processing
      const cleanedSubject = cleanEmailSubject(email.subject || '');
      const cleanedBody = cleanEmailContent(email.body || '', {
        stripHtml: true,
        removeSignatures: true,
        removeQuoted: true,
        removeDisclaimers: true,
        removeInlineContent: true,
        maxLength: 5000 // Higher limit for classification (needs more context)
      });

      // 2. Classify Email (using cleaned content)
      console.log('  📊 Classifying...');
      const { result: classificationRaw, usedLocal } = await this.classifierAgent.classify({
        subject: cleanedSubject,
        body: cleanedBody,
        sender: email.sender_email,
        senderName: email.sender_name || '',
        receivedAt: email.received_at
      });

      // Map to ClassificationResult interface
      const classification: ClassificationResult = {
        is_hierarchy: classificationRaw.is_hierarchy,
        is_client: classificationRaw.is_client,
        is_meeting: classificationRaw.is_meeting,
        is_escalation: classificationRaw.is_escalation,
        is_urgent: classificationRaw.is_urgent,
        suggested_label: classificationRaw.suggested_label || 'Uncategorized',
        reasoning: classificationRaw.reasoning
      };
      
      // 3. Generate Embedding (using aggressively cleaned content)
      console.log('  🧠 Generating embedding...');
      console.log("🚀 ~ EmailProcessingService ~ processEmail ~ email.body :", email.body )
      const cleanedBodyForEmbedding = cleanEmailContent(email.body || '', {
        stripHtml: true,
        removeSignatures: true,
        removeQuoted: true,
        removeDisclaimers: true,
        removeInlineContent: true,
        maxLength: 2500 // Aggressive limit for embedding
      });
      const textToEmbed = `${cleanedSubject} ${cleanedBodyForEmbedding}`;
      let embedding: number[] | null = null;
      let embeddingModel: string | null = null;
      try {
        const result = await embeddingService.generateEmbedding(textToEmbed);
        if (result) {
          embedding = result.embedding;
          embeddingModel = result.model;
          console.log(`  ✓ Generated ${embedding.length}D embedding using ${embeddingModel}`);
        }
      } catch (err: any) {
        console.warn(`  ⚠️  Embedding generation failed (continuing without vector): ${err.message}`);
      }

      // 4. Store Metadata & Embedding
      console.log('  💾 Storing metadata...');
      // Format embedding for pgvector: '[1,2,3]'
      const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

      await db.query(
        `INSERT INTO email_meta (
          email_id, is_hierarchy, is_client, is_meeting,
          is_escalation, is_urgent, classification, embedding, embedding_model,
          suggested_label, label_confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9, $10, $11)
        ON CONFLICT (email_id) DO UPDATE SET
          is_hierarchy = $2, is_client = $3, is_meeting = $4,
          is_escalation = $5, is_urgent = $6, classification = $7,
          embedding = $8::vector, embedding_model = $9`,
        [
          emailId,
          classification.is_hierarchy,
          classification.is_client,
          classification.is_meeting,
          classification.is_escalation,
          classification.is_urgent,
          JSON.stringify(classification),
          embeddingStr,
          embeddingModel,
          classification.suggested_label,
          0.0 // Initial confidence
        ]
      );

      // 5. Assign Labels
      console.log('  🏷️ Assigning labels...');
      // Note: labelAssignmentService might still use the global client internally.
      // ideally we should pass db down to it too, but let's stick to the immediate scope first.
      await this.labelAssignmentService.assignLabelsToEmail(
        emailId,
        email.account_id || 1, // Default to 1 if no account_id
        classification,
        embedding || undefined,
        db,
        embeddingModel || undefined
      );

      console.log(`✅ Email ${emailId} processed successfully`);

    } catch (error) {
      console.error(`Error processing email ${emailId}:`, error);
    }
  }
}
