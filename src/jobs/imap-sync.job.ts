import { Client } from 'pg';
import dotenv from 'dotenv';
import { fetchEmailsViaImap } from '../services/email/imap-email.service.js';
import { EmailProcessingService } from '../services/email/email-processing.service';

dotenv.config();

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

// Configuration
// const DELAY_BETWEEN_CLASSIFICATIONS = 500; // Unused now

/**
 * IMAP Email Sync Cron Job
 * Runs every 1 hour to:
 * 1. Fetch unread emails from IMAP accounts only
 * 2. Store new emails in database
 * 3. Classify emails using AI (only if not already classified)
 * 4. Set AI-generated labels on IMAP mailbox
 */
export async function runImapSyncJob() {
  const client = new Client({ connectionString: connection });
  const emailProcessingService = new EmailProcessingService();

  try {
    await client.connect();
    console.log('\n========================================');
    console.log('🔄 IMAP Sync Job Started');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log('========================================\n');

    // Step 1: Get all active IMAP accounts (NOT Gmail OAuth)
    const accountsResult = await client.query(`
      SELECT
        id,
        email,
        account_name,
        imap_host,
        imap_port,
        imap_username,
        imap_password_encrypted,
        enable_ai_labeling
      FROM email_accounts
      WHERE provider_type = 'imap'
        AND status = 'connected'
        AND auto_fetch = true
    `);

    const accounts = accountsResult.rows;
    console.log(`📧 Found ${accounts.length} active IMAP accounts\n`);

    if (accounts.length === 0) {
      console.log('⚠️  No active IMAP accounts to process');
      await client.end();
      return;
    }

    let totalProcessed = 0;
    let totalNewEmails = 0;
    let totalClassified = 0;
    let totalLabeled = 0;

    // Step 2: Process each IMAP account
    for (const account of accounts) {
      console.log(`\n--- Processing Account: ${account.email} ---`);

      try {
        // Fetch unread emails from IMAP
        const imapConfig = {
          host: account.imap_host,
          port: account.imap_port,
          username: account.imap_username,
          encryptedPassword: account.imap_password_encrypted
        };

        // Check if this is the first sync
        const isFirstSync = !account.last_sync;

        let emails;
        try {
          if (isFirstSync) {
            console.log(`  📥 First sync - Fetching emails from IMAP...`);
            // Fetch latest 10 emails on first sync for testing
            // Increase this number if you want to fetch more emails on first sync
            emails = await fetchEmailsViaImap(imapConfig, 10);
          } else {
            console.log(`  📥 Incremental sync - Fetching recent emails from IMAP...`);
            emails = await fetchEmailsViaImap(imapConfig, 50); // Fetch only last 50 emails
          }
          console.log(`  ✓ Successfully fetched ${emails.length} emails from IMAP`);
        } catch (fetchError: any) {
          console.error(`  ❌ Failed to fetch emails from IMAP: ${fetchError.message}`);
          continue; // Skip this account and move to next
        }

        if (emails.length > 30) {
          console.log(`  ⚠️  Processing ${emails.length} emails. This may take a while to avoid rate limits...`);
        }

        totalProcessed += emails.length;

        // Step 3: Store emails if not already in database
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
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
              RETURNING id`,
              [
                messageId,
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
            totalNewEmails++;
            console.log(`  ✓ Stored new email: "${email.subject.substring(0, 50)}..."`);
          } else {
            emailId = existingEmail.rows[0].id;
            console.log(`  ⊙ Email already exists: "${email.subject.substring(0, 50)}..."`);
          }

          // Step 4: Process Email (Classify + Embed + Assign Labels)
          if (email.isUnread) {
             // Using the centralized service ensures Embeddings are generated correctly
             await emailProcessingService.processEmail(emailId, client);
             totalClassified++;
             totalLabeled++; // Approximate
          } else {
             console.log(`  ⊙ Skipping classification for read email: "${email.subject.substring(0, 50)}..."`);
          }
        }

        // Update last_sync timestamp
        await client.query(
          'UPDATE email_accounts SET last_sync = NOW() WHERE id = $1',
          [account.id]
        );

        console.log(`✓ Completed processing for ${account.email}`);
      } catch (error: any) {
        console.error(`❌ Error processing account ${account.email}:`, error.message);
      }
    }

    // Summary
    console.log('\n========================================');
    console.log('✅ IMAP Sync Job Completed');
    console.log(`📊 Summary:`);
    console.log(`   - Accounts processed: ${accounts.length}`);
    console.log(`   - Total emails fetched: ${totalProcessed}`);
    console.log(`   - New emails stored: ${totalNewEmails}`);
    console.log(`   - Emails classified: ${totalClassified}`);
    console.log(`   - Labels set on IMAP: ${totalLabeled}`);
    console.log('========================================\n');

    await client.end();
  } catch (error: any) {
    console.error('❌ IMAP Sync Job Error:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

// If running directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  runImapSyncJob()
    .then(() => {
      console.log('Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Job failed:', error);
      process.exit(1);
    });
}
