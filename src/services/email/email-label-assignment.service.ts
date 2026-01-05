import { client } from '../../config/db.js';
import { LabelService } from '../label/label.service.js';
import { syncAILabelToImap } from '../label/imap-label.service.js';
import { ClassificationResult } from '../ai/gemini-classifier.service.js';
import { LabelApprovalService } from '../label/label-approval.service.js';
import { embeddingService } from '../ai/embedding.service.js';

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
  /**
   * Main method to assign labels to an email
   */
  async assignLabelsToEmail(
    emailId: number,
    accountId: number,
    classification: ClassificationResult,
    embedding?: number[],
    dbClient?: any,
    embeddingModel?: string
  ): Promise<void> {
    const db = dbClient || client;
    try {
      console.log(`🏷️ Assigning labels for email ${emailId}...`);

      // 1. Initialize system labels if needed
      console.log(`  [1/7] Initializing system labels...`);
      await this.labelService.initializeSystemLabels(db);
      console.log(`  ✓ System labels initialized`);

      // 2. Check if email already has labels (skip if manually assigned)
      console.log(`  [2/7] Checking existing labels...`);
      const existingLabels = await this.labelService.getEmailLabels(emailId, db);
      console.log(`  ✓ Found ${existingLabels.length} existing labels`);
      if (existingLabels.some(l => l.is_system === false)) {
        console.log('  → Email already has custom labels, skipping auto-assignment');
        return;
      }

      // 3. Match System Labels (Escalation, Urgent, Important)
      console.log(`  [3/7] Assigning system labels...`);
      const systemLabelsToAssign: string[] = [];

      if (classification.is_escalation) systemLabelsToAssign.push('Escalation');
      if (classification.is_urgent) systemLabelsToAssign.push('Urgent');
      if (classification.is_meeting) systemLabelsToAssign.push('MOM');

      for (const labelName of systemLabelsToAssign) {
        const label = await this.labelService.findLabelByName(labelName, undefined, db);
        if (label) {
          await this.labelService.assignLabelToEmail(emailId, label.id, 'system', 1.0, db);
          console.log(`  ✓ Assigned system label: ${labelName}`);
        }
      }

      // 4. Hybrid Classification (LLM + Similarity)
      console.log(`  [4/7] Getting AI suggestions...`);
      let hybridLabelName: string | null = null;
      let hybridConfidence = 0;
      let suggestionMethod = 'ai';

      // A. Get LLM Suggestion
      console.log("🚀 ~ EmailLabelAssignmentService ~ assignLabelsToEmail ~ classification.suggested_label:", classification.suggested_label)
      if (classification.suggested_label && !['Uncategorized', 'None'].includes(classification.suggested_label)) {
        hybridLabelName = classification.suggested_label;
        hybridConfidence = 0.6; // Base confidence for LLM
        console.log(`  → AI suggested: ${hybridLabelName}`);
      }

      // B. Get Similarity Suggestions (if embedding provided)
      // TEMPORARILY DISABLED TO DEBUG HANGING ISSUE
      console.log(`  [5/7] Similarity search (DISABLED for debugging)...`);
      if (false && embedding && embeddingModel) { // Temporarily disabled
        try {
          console.log(`    → Searching for similar emails...`);
          const similarEmails = await embeddingService.findSimilarEmails(embedding, embeddingModel, 5, 0.85);
          console.log(`    ✓ Found ${similarEmails.length} similar emails`);

          console.log(`    → Checking label centroids...`);
          const similarLabels = await embeddingService.suggestLabelsFromEmbeddings(embedding, 1);
          console.log(`    ✓ Found ${similarLabels.length} similar labels`);

          if (similarLabels.length > 0 && similarLabels[0].similarity > 0.85) {
            // Strong match with label centroid
            const centroidLabel = similarLabels[0];
            console.log(`  🧠 Found similar label centroid: ${centroidLabel.name} (${centroidLabel.similarity.toFixed(2)})`);

            if (centroidLabel.name === hybridLabelName) {
              // Agreement! Boost confidence
              hybridConfidence = 0.95;
              suggestionMethod = 'hybrid';
            } else {
              // Similarity overrides LLM if very high confidence
              hybridLabelName = centroidLabel.name;
              hybridConfidence = centroidLabel.similarity;
              suggestionMethod = 'similarity';
            }
          }
        } catch (similarityError) {
          console.warn(`  ⚠️  Similarity search failed:`, similarityError);
          // Continue with LLM suggestion only
        }
      } else if (embedding && !embeddingModel) {
        console.log(`  ⚠️  Embedding provided but model unknown, skipping similarity search`);
      }

      // 5. Process Hybrid Suggestion
      console.log(`  [6/7] Processing label suggestions...`);
      const systemLabels = ['MOM', 'Escalation', 'Urgent', 'Uncategorized'];

      if (hybridLabelName && !systemLabels.includes(hybridLabelName)) {
        console.log(`    → Processing suggestion: ${hybridLabelName}`);
        const userId = await this.getUserIdFromAccount(accountId, db);
        console.log(`    → User ID: ${userId}`);

        if (userId) {
          // Check if user already has this label approved
          let existingLabel = await this.labelService.findLabelByName(hybridLabelName, userId, db);

          if (existingLabel) {
            // Label exists
            if (hybridConfidence > 0.8) {
              // High confidence -> Auto assign
              await this.labelService.assignLabelToEmail(emailId, existingLabel.id, 'ai', hybridConfidence, db);
              
              // Update label embedding with this new email
              if (embedding) {
                await embeddingService.updateLabelEmbedding(existingLabel.id, embedding);
              }
              
              console.log(`  ✓ Auto-assigned label: ${hybridLabelName} (confidence: ${hybridConfidence.toFixed(2)})`);
            } else {
              // Medium confidence -> Suggest
              // Check if suggestion already exists
              // (Skipping check here as createPendingSuggestion handles it)
              await this.approvalService.createPendingSuggestion({
                email_id: emailId,
                user_id: userId,
                suggested_label_name: hybridLabelName,
                suggested_by: suggestionMethod as 'ai' | 'system' | 'similarity' | 'hybrid',
                confidence_score: hybridConfidence,
                reasoning: classification.reasoning || `AI suggested "${hybridLabelName}" based on ${suggestionMethod}`
              });
              console.log(`  📋 Created suggestion: ${hybridLabelName} (confidence: ${hybridConfidence.toFixed(2)})`);
            }
          } else {
            // Label doesn't exist -> Always suggest (never auto-create new labels without approval)
            await this.approvalService.createPendingSuggestion({
              email_id: emailId,
              user_id: userId,
              suggested_label_name: hybridLabelName,
              suggested_by: suggestionMethod as 'ai' | 'system' | 'similarity' | 'hybrid',
              confidence_score: hybridConfidence,
              reasoning: classification.reasoning || `AI suggested new label "${hybridLabelName}"`
            });
            console.log(`  📋 Created new label suggestion: ${hybridLabelName}`);
          }
        }
      }

      // 6. Sync to IMAP
      console.log(`  [7/7] Syncing to IMAP...`);
      // Get account details to sync
      const account = await this.getAccountDetails(accountId, db);
      console.log(`    → Got account details: ${account?.provider_type}`);
      if (account && (account.provider_type === 'imap' || account.provider_type === 'gmail')) {
        const email = await this.getEmailDetails(emailId, db);
        if (email && email.message_id) {
          // Get all assigned labels
          const finalLabels = await this.labelService.getEmailLabels(emailId, db);
          console.log(`  🔄 Syncing ${finalLabels.length} labels to IMAP...`);

          // Use imap_uid and imap_mailbox if available (faster and more reliable than Message-ID search)
          const imapUid = email.imap_uid;
          const imapMailbox = email.imap_mailbox;

          if (imapUid && imapMailbox) {
            console.log(`    → Using IMAP UID: ${imapUid} in mailbox: ${imapMailbox} for faster label sync`);
          } else if (imapUid) {
            console.log(`    ⚠️  IMAP UID: ${imapUid} found but mailbox unknown - may label wrong email!`);
          } else {
            console.log(`    → No IMAP UID found, will search by Message-ID: ${email.message_id}`);
          }

          for (const label of finalLabels) {
            try {
              await syncAILabelToImap(
                {
                  imap_host: account.imap_host,
                  imap_port: account.imap_port,
                  imap_username: account.imap_username,
                  imap_password_encrypted: account.imap_password_encrypted
                },
                email.message_id,
                label.name,
                imapUid,
                imapMailbox
              );
              console.log(`    ✓ Synced label: ${label.name}`);
            } catch (syncError) {
              console.warn(`    ⚠️  Failed to sync label ${label.name}:`, syncError);
            }
          }
        }
      }

      console.log(`  ✅ Label assignment completed for email ${emailId}`);

    } catch (error) {
      console.error(`  ❌ Error in assignLabelsToEmail for email ${emailId}:`, error);
      throw error; // Re-throw to let caller handle
    }
  }

  private async getUserIdFromAccount(accountId: number, db?: any): Promise<number | null> {
    try {
      const dbClient = db || client;
      const result = await dbClient.query(
        'SELECT user_id FROM email_accounts WHERE id = $1',
        [accountId]
      );

      if (result.rows.length > 0 && result.rows[0].user_id) {
        return result.rows[0].user_id;
      }

      console.warn(`⚠️  No user_id found for account ${accountId}, defaulting to user 1`);
      return 1; // Fallback to default admin user
    } catch (error: any) {
      console.error(`❌ Error getting user_id for account ${accountId}:`, error.message);
      return 1; // Fallback to default admin user on error
    }
  }

  private async getAccountDetails(accountId: number, db: any): Promise<any> {
    try {
      const result = await db.query('SELECT * FROM email_accounts WHERE id = $1', [accountId]);

      if (result.rows.length === 0) {
        console.warn(`⚠️  Account ${accountId} not found`);
        return null;
      }

      return result.rows[0];
    } catch (error: any) {
      console.error(`❌ Error fetching account ${accountId}:`, error.message);
      throw error;
    }
  }

  private async getEmailDetails(emailId: number, db: any): Promise<any> {
    try {
      const result = await db.query('SELECT * FROM emails WHERE id = $1', [emailId]);

      if (result.rows.length === 0) {
        console.warn(`⚠️  Email ${emailId} not found`);
        return null;
      }

      return result.rows[0];
    } catch (error: any) {
      console.error(`❌ Error fetching email ${emailId}:`, error.message);
      throw error;
    }
  }
}
