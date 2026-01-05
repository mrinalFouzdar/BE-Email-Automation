import { db } from '../../config/database.config.js';
import {
  PendingLabelSuggestion,
  PendingLabelSuggestionCreateInput,
  PendingLabelApprovalInput,
} from '../../types/label.types.js';
import { LabelService } from './label.service.js';
import { syncAILabelToImap } from './imap-label.service.js';
import { logger } from '../../utils/logger.util.js';
import { embeddingService } from '../ai/embedding.service.js';

export class LabelApprovalService {
  private labelService: LabelService;

  constructor() {
    this.labelService = new LabelService();
  }

  /**
   * Create a new pending label suggestion
   */
  async createPendingSuggestion(input: PendingLabelSuggestionCreateInput): Promise<PendingLabelSuggestion> {
    try {
      // Check if similar suggestion already exists and is pending
      const existing = await db.query(
        `SELECT * FROM pending_label_suggestions 
         WHERE email_id = $1 AND suggested_label_name = $2 AND status = 'pending'`,
        [input.email_id, input.suggested_label_name]
      );

      if (existing.rows.length > 0) {
        // Already exists, just return it
        return existing.rows[0];
      }

      // Create new suggestion
      const result = await db.query(
        `INSERT INTO pending_label_suggestions (
           email_id, user_id, suggested_label_name, suggested_by, 
           confidence_score, reasoning, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [
          input.email_id,
          input.user_id,
          input.suggested_label_name,
          input.suggested_by,
          input.confidence_score,
          input.reasoning
        ]
      );

      logger.info(`Created pending label suggestion: ${input.suggested_label_name} for email ${input.email_id}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating pending suggestion:', error);
      throw error;
    }
  }

  // ... (existing methods)

  /**
   * Get all pending label suggestions with details
   */
  async getAllPendingSuggestions(): Promise<(PendingLabelSuggestion & { subject: string; user_email: string })[]> {
    const result = await db.query(`
      SELECT
        pls.*,
        e.subject as email_subject,
        e.sender_email as email_sender,
        e.body as email_body,
        u.email as user_email
      FROM pending_label_suggestions pls
      JOIN emails e ON pls.email_id = e.id
      JOIN users u ON pls.user_id = u.id
      WHERE pls.status = 'pending'
      ORDER BY pls.created_at DESC
    `);
    // console.log("🚀 ~ LabelApprovalService ~ getAllPendingSuggestions ~ result:", result)

    return result.rows;
  }

  /**
   * Get pending label suggestions for a specific user
   */
  async getPendingSuggestionsByUser(userId: number): Promise<(PendingLabelSuggestion & { subject: string })[]> {
    const result = await db.query(`
      SELECT
        pls.*,
        e.subject as email_subject,
        e.sender_email as email_sender,
        e.body as email_body
      FROM pending_label_suggestions pls
      JOIN emails e ON pls.email_id = e.id
      WHERE pls.user_id = $1 AND pls.status = 'pending'
      ORDER BY pls.created_at DESC
    `, [userId]);
    // console.log("🚀 ~ LabelApprovalService ~ getPendingSuggestionsByUser ~ result:", result)

    return result.rows;
  }

  /**
   * Approve or reject a label suggestion
   */
  async processSuggestion(input: PendingLabelApprovalInput): Promise<{
    success: boolean;
    message: string;
    label_id?: number;
  }> {
    try {
      // Get the suggestion
      const suggestionResult = await db.query(
        'SELECT * FROM pending_label_suggestions WHERE id = $1',
        [input.suggestion_id]
      );

      if (suggestionResult.rows.length === 0) {
        return { success: false, message: 'Suggestion not found' };
      }

      const suggestion: PendingLabelSuggestion = suggestionResult.rows[0];

      if (suggestion.status !== 'pending') {
        return { success: false, message: `Suggestion already ${suggestion.status}` };
      }

      if (input.action === 'reject') {
        // Mark as rejected
        await db.query(
          `UPDATE pending_label_suggestions
           SET status = 'rejected', approved_by = $1, approved_at = NOW()
           WHERE id = $2`,
          [input.approved_by, input.suggestion_id]
        );

        logger.info(`Label suggestion rejected: ${suggestion.suggested_label_name}`);
        return { success: true, message: 'Suggestion rejected' };
      }

      // APPROVE - Create label and apply it

      // 1. Check if label already exists
      let label = await this.labelService.findLabelByName(
        suggestion.suggested_label_name,
        suggestion.user_id
      );

      if (!label) {
        // 2. Create the label
        label = await this.labelService.createLabel({
          name: suggestion.suggested_label_name,
          color: this.generateRandomColor(),
          description: `AI-suggested label (approved)`,
          isSystem: false,
          userId: suggestion.user_id,
        });

        // 3. Assign label to user
        await this.labelService.assignLabelToUser(label.id, suggestion.user_id);

        logger.info(`Created new label: ${label.name} for user ${suggestion.user_id}`);
      }

      // 4. Assign label to the email
      await this.labelService.assignLabelToEmail(
        suggestion.email_id,
        label.id,
        'user',  // Since user/admin approved it
        suggestion.confidence_score || 1.0
      );
      logger.info(`Assigned label "${label.name}" (id: ${label.id}) to email ${suggestion.email_id}`);

      // 5. Update emails.labels array
      await db.query(
        `UPDATE emails SET labels = array_append(COALESCE(labels, '{}'), $1)
         WHERE id = $2 AND NOT ($1 = ANY(COALESCE(labels, '{}')))`,
        [label.name, suggestion.email_id]
      );
      logger.info(`Updated labels array for email ${suggestion.email_id}`);

      // 6. Sync to Gmail/IMAP mailbox
      try {
        const emailResult = await db.query(
          'SELECT e.*, a.* FROM emails e JOIN email_accounts a ON e.account_id = a.id WHERE e.id = $1',
          [suggestion.email_id]
        );

        if (emailResult.rows.length > 0) {
          const email = emailResult.rows[0];
          const account = emailResult.rows[0];

          logger.info(`📧 Email details for sync:`);
          logger.info(`   Email ID: ${email.id}`);
          logger.info(`   Subject: ${email.subject}`);
          logger.info(`   From: ${email.sender_email}`);
          logger.info(`   Message-ID (gmail_id): ${email.gmail_id}`);
          logger.info(`   IMAP UID: ${email.imap_uid || 'not available'}`);
          logger.info(`   IMAP Mailbox: ${email.imap_mailbox || 'not available'}`);
          logger.info(`   Account: ${account.imap_username}`);

          if (account.enable_ai_labeling) {
            logger.info(`🔄 Attempting to sync label "${label.name}" to Gmail...`);

            const syncResult = await syncAILabelToImap(
              {
                imap_host: account.imap_host,
                imap_port: account.imap_port,
                imap_username: account.imap_username,
                imap_password_encrypted: account.imap_password_encrypted,
              },
              email.gmail_id,
              label.name,
              email.imap_uid,
              email.imap_mailbox
            );

            if (syncResult.success) {
              logger.info(`✅ Successfully synced label "${label.name}" to IMAP/Gmail for email ${suggestion.email_id}`);
              logger.info(`   Method used: ${syncResult.method || 'unknown'}`);
            } else {
              logger.error(`❌ Failed to sync label to Gmail: ${syncResult.error}`);
            }
          } else {
            logger.info(`⊙ AI labeling disabled for account ${account.imap_username}`);
          }
        }
      } catch (syncError) {
        logger.error('Error syncing label to IMAP:', syncError);
        logger.error('Stack trace:', syncError.stack);
        // Continue even if sync fails - label is still assigned in database
      }

      // 7. Update Label Embedding (LEARNING STEP)
      try {
        const embeddingResult = await db.query(
          'SELECT embedding FROM email_meta WHERE email_id = $1',
          [suggestion.email_id]
        );
        
        if (embeddingResult.rows.length > 0 && embeddingResult.rows[0].embedding) {
           // Parse embedding if it's a string (pgvector driver might return string)
           let embedding = embeddingResult.rows[0].embedding;
           if (typeof embedding === 'string') {
             embedding = JSON.parse(embedding);
           }
           
           await embeddingService.updateLabelEmbedding(label.id, embedding);
           logger.info(`Updated label embedding for "${label.name}" (learning from approval)`);
        }
      } catch (learnError) {
        logger.error('Error updating label embedding:', learnError);
      }

      // 8. Mark suggestion as approved
      await db.query(
        `UPDATE pending_label_suggestions
         SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [input.approved_by, input.suggestion_id]
      );

      logger.info(`Label suggestion approved: ${suggestion.suggested_label_name} -> label_id ${label.id}`);

      return {
        success: true,
        message: 'Label created and applied successfully',
        label_id: label.id,
      };
    } catch (error) {
      logger.error('Error processing suggestion:', error);
      throw error;
    }
  }

  /**
   * Auto-apply label to similar emails based on vector similarity
   * Called after a label is approved
   */
  async autoApplyToSimilarEmails(
    labelId: number,
    userId: number,
    emailId: number,
    similarityThreshold: number = 0.85
  ): Promise<number> {
    try {
      // Get the embedding of the approved email
      const embeddingResult = await db.query(
        'SELECT embedding FROM email_meta WHERE email_id = $1',
        [emailId]
      );

      if (embeddingResult.rows.length === 0 || !embeddingResult.rows[0].embedding) {
        logger.warn(`No embedding found for email ${emailId}`);
        return 0;
      }

      const embedding = embeddingResult.rows[0].embedding;

      // Find similar emails for the same user that don't have this label
      const similarEmailsResult = await db.query(
        `SELECT e.id, e.gmail_id, e.imap_uid, e.imap_mailbox, e.account_id,
                1 - (em.embedding <=> $1::vector) as similarity
         FROM emails e
         JOIN email_meta em ON e.id = em.email_id
         LEFT JOIN email_labels el ON e.id = el.email_id AND el.label_id = $2
         WHERE e.id != $3
           AND em.embedding IS NOT NULL
           AND 1 - (em.embedding <=> $1::vector) >= $4
           AND el.id IS NULL  -- Don't already have this label
           AND e.account_id IN (SELECT id FROM email_accounts WHERE user_id = $5)
         ORDER BY similarity DESC
         LIMIT 10`,
        [embedding, labelId, emailId, similarityThreshold, userId]
      );

      let appliedCount = 0;

      for (const row of similarEmailsResult.rows) {
        try {
          // Get label name
          const labelResult = await db.query('SELECT name FROM labels WHERE id = $1', [labelId]);
          const labelName = labelResult.rows[0].name;

          // Assign label
          await this.labelService.assignLabelToEmail(row.id, labelId, 'ai', row.similarity);

          // Update emails.labels array
          await db.query(
            `UPDATE emails SET labels = array_append(COALESCE(labels, '{}'), $1)
             WHERE id = $2 AND NOT ($1 = ANY(COALESCE(labels, '{}')))`,
            [labelName, row.id]
          );

          // Sync to IMAP/Gmail
          const accountResult = await db.query(
            'SELECT * FROM email_accounts WHERE id = $1',
            [row.account_id]
          );

          if (accountResult.rows.length > 0) {
            const account = accountResult.rows[0];
            if (account.enable_ai_labeling) {
              await syncAILabelToImap(
                {
                  imap_host: account.imap_host,
                  imap_port: account.imap_port,
                  imap_username: account.imap_username,
                  imap_password_encrypted: account.imap_password_encrypted,
                },
                row.gmail_id,
                labelName,
                row.imap_uid,
                row.imap_mailbox
              );
            }
          }

          appliedCount++;
          logger.info(`Auto-applied label ${labelName} to similar email ${row.id} (similarity: ${row.similarity})`);
        } catch (error) {
          logger.error(`Error auto-applying label to email ${row.id}:`, error);
          // Continue with next email
        }
      }

      return appliedCount;
    } catch (error) {
      logger.error('Error in autoApplyToSimilarEmails:', error);
      throw error;
    }
  }

  /**
   * Generate a random color for new labels
   */
  private generateRandomColor(): string {
    const colors = [
      '#EF4444', // Red
      '#F59E0B', // Orange
      '#10B981', // Green
      '#3B82F6', // Blue
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#14B8A6', // Teal
      '#F97316', // Deep Orange
    ];

    return colors[Math.floor(Math.random() * colors.length)];
  }
}

export const labelApprovalService = new LabelApprovalService();
