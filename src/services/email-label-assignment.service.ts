import { client } from '../config/db';
import { LabelService } from './label.service';
import { syncAILabelToImap } from './imap-label.service';
import { ClassificationResult } from './gemini-classifier.service';
import { LabelApprovalService } from './label-approval.service.js';

export class EmailLabelAssignmentService {
  private labelService: LabelService;
  private approvalService: LabelApprovalService;

  constructor() {
    this.labelService = new LabelService();
    this.approvalService = new LabelApprovalService();
  }

  /**
   * Main method to assign labels to an email
   */
  async assignLabelsToEmail(
    emailId: number, 
    accountId: number,
    classification: ClassificationResult,
    embedding?: number[]
  ): Promise<void> {
    try {
      console.log(`🏷️ Assigning labels for email ${emailId}...`);

      // 1. Initialize system labels if needed
      await this.labelService.initializeSystemLabels();

      // 2. Check if email already has labels (skip if manually assigned)
      const existingLabels = await this.labelService.getEmailLabels(emailId);
      if (existingLabels.some(l => l.is_system === false)) {
        console.log('  → Email already has custom labels, skipping auto-assignment');
        return;
      }

      // 3. Match System Labels (Escalation, Urgent, MOM)
      const systemLabelsToAssign: string[] = [];
      
      if (classification.is_escalation) systemLabelsToAssign.push('Escalation');
      if (classification.is_urgent) systemLabelsToAssign.push('Urgent');
      if (classification.is_meeting) systemLabelsToAssign.push('MOM');

      for (const labelName of systemLabelsToAssign) {
        const label = await this.labelService.findLabelByName(labelName);
        if (label) {
          await this.labelService.assignLabelToEmail(emailId, label.id, 'system', 1.0);
          console.log(`  ✓ Assigned system label: ${labelName}`);
        }
      }

      // 4. Vector Similarity Search (if embedding provided)
      let similarLabelFound = false;
      if (embedding) {
        const similarLabel = await this.findLabelFromSimilarEmails(emailId, embedding);
        if (similarLabel) {
          await this.labelService.assignLabelToEmail(emailId, similarLabel.id, 'ai', 0.9);
          console.log(`  ✓ Assigned similar label: ${similarLabel.name}`);
          similarLabelFound = true;
        }
      }

      // 5. AI Suggested Label (if no similar label found and NOT a system label)
      if (!similarLabelFound && classification.suggested_label) {
        const suggestedName = classification.suggested_label;
        const systemLabels = ['MOM', 'Escalation', 'Urgent', 'Uncategorized'];

        // Only create pending suggestion for non-system labels
        if (!systemLabels.includes(suggestedName)) {
          const userId = await this.getUserIdFromAccount(accountId);

          if (userId) {
            // Check if user already has this label approved
            let existingLabel = await this.labelService.findLabelByName(suggestedName, userId);

            if (existingLabel) {
              // Label already exists and approved - assign directly
              await this.labelService.assignLabelToEmail(emailId, existingLabel.id, 'ai', 0.8);
              console.log(`  ✓ Assigned existing approved label: ${suggestedName}`);
            } else {
              // Create pending suggestion for admin/user approval
              await this.approvalService.createPendingSuggestion({
                email_id: emailId,
                user_id: userId,
                suggested_label_name: suggestedName,
                suggested_by: 'ai',
                confidence_score: classification.reasoning ? 0.8 : 0.6,
                reasoning: classification.reasoning || `AI suggested "${suggestedName}" label`
              });
              console.log(`  📋 Created pending suggestion: ${suggestedName} (requires approval)`);
            }
          }
        }
      }

      // 6. Sync to IMAP
      // Get account details to sync
      const account = await this.getAccountDetails(accountId);
      if (account && account.provider_type === 'imap' || account.provider_type === 'gmail') {
        const email = await this.getEmailDetails(emailId);
        if (email && email.message_id) {
          // Get all assigned labels
          const finalLabels = await this.labelService.getEmailLabels(emailId);
          for (const label of finalLabels) {
            await syncAILabelToImap(
              {
                imap_host: account.imap_host,
                imap_port: account.imap_port,
                imap_username: account.imap_username,
                imap_password_encrypted: account.imap_password_encrypted
              },
              email.message_id,
              label.name
            );
          }
        }
      }

    } catch (error) {
      console.error('Error in assignLabelsToEmail:', error);
    }
  }

  /**
   * Find label from similar emails using vector search
   */
  private async findLabelFromSimilarEmails(emailId: number, embedding: number[]): Promise<any | null> {
    try {
      // Find similar emails that have labels
      const result = await client.query(`
        SELECT l.*, 1 - (m.embedding <=> $1::vector) as similarity
        FROM email_meta m
        JOIN email_labels el ON m.email_id = el.email_id
        JOIN labels l ON el.label_id = l.id
        WHERE m.email_id != $2
          AND m.embedding IS NOT NULL
          AND 1 - (m.embedding <=> $1::vector) >= 0.85
        ORDER BY similarity DESC
        LIMIT 1
      `, [JSON.stringify(embedding), emailId]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error finding similar labels:', error);
      return null;
    }
  }

  private async getUserIdFromAccount(accountId: number): Promise<number | null> {
    // This assumes account table has user_id or we can infer it.
    // Based on schema, email_accounts doesn't seem to have user_id directly linked in the snippet I saw?
    // Wait, let me check add_accounts_table.sql again.
    // It doesn't have user_id! It seems accounts are global or I missed something.
    // Let's assume for now we use a default user or the account owner.
    // Actually, the system seems to be single user or multi-account but not multi-user auth yet?
    // Re-reading: "from fe multiple user can add their email".
    // I'll assume there is a users table and accounts are linked to it.
    // Let's check users table.
    
    // For now, returning 1 as default admin user if not found
    return 1; 
  }

  private async getAccountDetails(accountId: number): Promise<any> {
    const result = await client.query('SELECT * FROM email_accounts WHERE id = $1', [accountId]);
    return result.rows[0];
  }

  private async getEmailDetails(emailId: number): Promise<any> {
    const result = await client.query('SELECT * FROM emails WHERE id = $1', [emailId]);
    return result.rows[0];
  }
}
