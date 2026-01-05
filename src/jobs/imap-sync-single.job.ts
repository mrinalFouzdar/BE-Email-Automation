import { Client } from 'pg';
import dotenv from 'dotenv';
import { fetchEmailsViaImap } from '../services/email/imap-email.service.js';
import { EmailProcessingService } from '../services/email/email-processing.service';
import { pdfProcessingService } from '../services/pdf/pdf-processing.service.js';

dotenv.config();

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

/**
 * Sync emails for a single IMAP account
 * Used when a new account is added or manual sync is triggered
 * @param accountId - ID of the email account to sync
 */
export async function syncSingleImapAccount(accountId: number) {
  const client = new Client({ connectionString: connection });
  const emailProcessingService = new EmailProcessingService();

  try {
    await client.connect();
    console.log(`\n🔄 Syncing IMAP Account ID: ${accountId}`);

    // Get account details
    const accountResult = await client.query(`
      SELECT
        id,
        email,
        account_name,
        imap_host,
        imap_port,
        imap_username,
        imap_password_encrypted,
        enable_ai_labeling,
        provider_type,
        status
      FROM email_accounts
      WHERE id = $1 AND provider_type = 'imap'
    `, [accountId]);

    if (accountResult.rows.length === 0) {
      console.log('⚠️  Account not found or not an IMAP account');
      await client.end();
      return { success: false, error: 'Account not found or not IMAP' };
    }

    const account = accountResult.rows[0];
    console.log(`📧 Processing: ${account.email}`);

    if (account.status !== 'connected') {
      console.log('⚠️  Account status is not "connected"');
      await client.end();
      return { success: false, error: 'Account not connected' };
    }

    // Check if this is the first sync
    const isFirstSync = !account.last_sync;

    // Fetch emails from IMAP
    const imapConfig = {
      host: account.imap_host,
      port: account.imap_port,
      username: account.imap_username,
      encryptedPassword: account.imap_password_encrypted
    };

    let emails;
    try {
      if (isFirstSync) {
        console.log(`📥 First sync - Fetching emails from IMAP...`);
        // Fetch latest 10 emails on first sync for testing
        // Increase this number if you want to fetch more emails on first sync
        emails = await fetchEmailsViaImap(imapConfig, 1);
        // console.log("🚀 ~ syncSingleImapAccount ~ emails:", emails)
      } else {
        console.log(`📥 Incremental sync - Fetching recent emails from IMAP...`);
        emails = await fetchEmailsViaImap(imapConfig, 50); // Fetch only last 50 emails
      }
      console.log(`✓ Successfully fetched ${emails.length} emails from IMAP`);
    } catch (fetchError: any) {
      console.error(`❌ Failed to fetch emails from IMAP: ${fetchError.message}`);
      await client.end();
      return { success: false, error: `IMAP fetch failed: ${fetchError.message}` };
    }

    if (emails.length > 30) {
      console.log(`⚠️  Processing ${emails.length} emails. This may take a while to avoid rate limits...`);
    }

    let newEmails = 0;
    let classified = 0;
    let labeled = 0;
    
    // Process each email
    for (const email of emails) {
      const messageId = email.messageId;

      // Check if email already exists
      const existingEmail = await client.query(
        'SELECT id, gmail_id FROM emails WHERE gmail_id = $1 OR gmail_id LIKE $2',
        [messageId, `%${messageId}%`]
      );

      let emailId: number;

      if (existingEmail.rows.length === 0) {
        // New email - insert into database
        const insertResult = await client.query(
          `INSERT INTO emails (
            gmail_id,
            message_id,
            imap_uid,
            imap_mailbox,
            sender_email,
            to_recipients,
            cc_recipients,
            recipients,
            subject,
            body,
            is_unread,
            received_at,
            account_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          RETURNING id`,
          [
            messageId,
            messageId,  // Use same messageId for both gmail_id and message_id
            email.imapUid,
            email.imapMailbox,
            email.from,
            email.to || [],
            email.cc || [],
            [...(email.to || []), ...(email.cc || [])],
            email.subject,
            email.body,
            email.isUnread,
            email.date,
            account.id
          ]
        );

        emailId = insertResult.rows[0].id;
        newEmails++;
        console.log(`  ✓ Stored new email: "${email.subject.substring(0, 50)}..."`);
      } else {
        emailId = existingEmail.rows[0].id;
        console.log(`  ⊙ Email already exists: "${email.subject.substring(0, 50)}..."`);
        continue; // Skip processing if email already exists
      }

      // Process PDF Attachments
      if (email.attachments && email.attachments.length > 0) {
        console.log(`  📎 Processing ${email.attachments.length} PDF attachment(s)...`);
        for (const attachment of email.attachments) {
          try {
            const processedPDF = await pdfProcessingService.processPDFAttachment(attachment);
            await pdfProcessingService.storePDFAttachment(emailId, processedPDF, attachment.content);
            console.log(`  ✓ Stored PDF: ${attachment.filename}`);
          } catch (pdfError: any) {
            console.error(`  ❌ Failed to process PDF ${attachment.filename}: ${pdfError.message}`);
          }
        }
      }

      // Process email (Classify + Embed + Assign Labels)
      // Only classify UNREAD emails
      if (email.isUnread) {
         // Using the centralized service ensures Embeddings are generated correctly
         await emailProcessingService.processEmail(emailId, client);
         classified++;
         labeled++; // Approximate: Process service attempts labeling
      } else {
         console.log(`  ⊙ Skipping classification for read email: "${email.subject.substring(0, 50)}..."`);
      }
    }

    console.log(`\n✅ Sync completed for ${account.email}`);
    console.log(`   - Total emails: ${emails.length}`);
    console.log(`   - New emails: ${newEmails}`);
    console.log(`   - Classified: ${classified}`);
    console.log(`   - Labels set: ${labeled} (approx)\n`);

    // Update last_sync timestamp
    await client.query(
      'UPDATE email_accounts SET last_sync = NOW(), status = $1 WHERE id = $2',
      ['connected', account.id]
    );

    console.log(`\n✅ Sync completed for ${account.email}`);
    console.log(`   - Total emails: ${emails.length}`);
    console.log(`   - New emails: ${newEmails}`);
    console.log(`   - Classified: ${classified}`);
    console.log(`   - Labels set: ${labeled}\n`);

    await client.end();

    return {
      success: true,
      stats: {
        total: emails.length,
        new: newEmails,
        classified,
        labeled
      }
    };
  } catch (error: any) {
    console.error(`❌ Error syncing account ${accountId}:`, error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    return { success: false, error: error.message };
  }
}
