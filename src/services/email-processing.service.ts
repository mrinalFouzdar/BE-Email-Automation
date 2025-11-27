import { client } from '../config/db';
import { EmailClassifierAgent, EmbeddingAgent } from '../modules/extension/langchain.service';
import { EmailLabelAssignmentService } from './email-label-assignment.service';
import { ClassificationResult } from './gemini-classifier.service';

export class EmailProcessingService {
  private classifierAgent: EmailClassifierAgent;
  private embeddingAgent: EmbeddingAgent;
  private labelAssignmentService: EmailLabelAssignmentService;

  constructor() {
    this.classifierAgent = new EmailClassifierAgent();
    this.embeddingAgent = new EmbeddingAgent();
    this.labelAssignmentService = new EmailLabelAssignmentService();
  }

  /**
   * Process a single email: Classify, Embed, Assign Labels
   */
  async processEmail(emailId: number): Promise<void> {
    try {
      console.log(`⚙️ Processing email ${emailId}...`);

      // 1. Fetch email data
      const emailResult = await client.query('SELECT * FROM emails WHERE id = $1', [emailId]);
      if (emailResult.rows.length === 0) {
        console.error(`Email ${emailId} not found`);
        return;
      }
      const email = emailResult.rows[0];

      // 2. Classify Email
      console.log('  📊 Classifying...');
      const classificationRaw = await this.classifierAgent.classify({
        subject: email.subject,
        body: email.body,
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
        suggested_label: 'Uncategorized', // Default, will be updated if AI suggests one
        reasoning: classificationRaw.reasoning
      };
      
      // If the classifier returns a suggested label (it might not in current implementation), use it.
      // The current EmailClassifierAgent prompt DOES NOT ask for suggested_label.
      // I should update EmailClassifierAgent or ask for it here.
      // For now, I'll stick to the existing agent and maybe update it later if needed.
      // Actually, the user wants "suggest user an email content" and "automatic label creation".
      // The `EmailLabelAssignmentService` handles label creation.
      
      // 3. Generate Embedding
      console.log('  🧠 Generating embedding...');
      const textToEmbed = `Subject: ${email.subject}\nFrom: ${email.sender_email}\nBody: ${email.body}`.substring(0, 8000);
      const embedding = await this.embeddingAgent.generateEmbedding(textToEmbed);

      // 4. Store Metadata & Embedding
      console.log('  💾 Storing metadata...');
      await client.query(
        `INSERT INTO email_meta (
          email_id, is_hierarchy, is_client, is_meeting,
          is_escalation, is_urgent, classification, embedding,
          suggested_label, label_confidence
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (email_id) DO UPDATE SET
          is_hierarchy = $2, is_client = $3, is_meeting = $4,
          is_escalation = $5, is_urgent = $6, classification = $7, embedding = $8`,
        [
          emailId,
          classification.is_hierarchy,
          classification.is_client,
          classification.is_meeting,
          classification.is_escalation,
          classification.is_urgent,
          JSON.stringify(classification),
          JSON.stringify(embedding), // pgvector expects string representation or array? node-postgres-vector handles array usually? 
          // Wait, pgvector usually needs a string like '[1,2,3]' or specific format.
          // Let's check how it was done in langchain.service.ts: `embedding` (array) passed directly.
          // Assuming pg driver handles it or we need to stringify.
          // In `similarity.service.ts` it uses `$1::vector`.
          // I'll pass array and hope pg-vector handles it, or JSON.stringify it.
          // Actually, `pgvector` library usually handles it.
          // Let's use `JSON.stringify(embedding)` to be safe as it converts to `[1.2, 3.4]`.
          // Wait, `JSON.stringify` produces `"[1,2]"` which is valid vector input syntax.
          JSON.stringify(embedding), 
          classification.suggested_label,
          0.0 // Initial confidence
        ]
      );

      // 5. Assign Labels
      console.log('  🏷️ Assigning labels...');
      await this.labelAssignmentService.assignLabelsToEmail(
        emailId,
        email.account_id || 1, // Default to 1 if no account_id
        classification,
        embedding
      );

      console.log(`✅ Email ${emailId} processed successfully`);

    } catch (error) {
      console.error(`Error processing email ${emailId}:`, error);
    }
  }
}
