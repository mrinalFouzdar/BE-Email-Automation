import { Client } from 'pg';
import dotenv from 'dotenv';
import { fetchEmailsViaImap } from '../services/imap-email.service.js';
import { classifyEmail } from '../services/classifier.service';
import { syncAILabelToImap } from '../services/imap-label.service';
import { sleep } from '../utils/rate-limiter';

dotenv.config();

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

// Configuration
const MAX_EMAILS_PER_BATCH = 50; // Process max 50 emails per sync
const DELAY_BETWEEN_CLASSIFICATIONS = 500; // 500ms delay between API calls

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

        console.log(`  📥 Fetching unread emails from IMAP...`);
        const emails = await fetchEmailsViaImap(imapConfig, MAX_EMAILS_PER_BATCH);
        console.log(`  ✓ Fetched ${emails.length} emails`);

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

          // Step 4: Check if email already has classification
          const metaResult = await client.query(
            'SELECT id, classification FROM email_meta WHERE email_id = $1',
            [emailId]
          );

          let aiLabel: string | null = null;

          if (metaResult.rows.length === 0) {
            // No classification yet - send to AI model
            console.log(`  🤖 Classifying email ${emailId} with AI... (${totalClassified + 1})`);

            try {
              const classification = await classifyEmail(
                email.subject,
                email.body,
                email.from
              );

              aiLabel = classification.suggested_label;

              // Store classification in database
              await client.query(
                `INSERT INTO email_meta (
                  email_id,
                  is_meeting,
                  is_escalation,
                  is_hierarchy,
                  is_client,
                  is_urgent,
                  classification,
                  created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [
                  emailId,
                  classification.is_meeting,
                  classification.is_escalation,
                  classification.is_hierarchy,
                  classification.is_client,
                  classification.is_urgent,
                  JSON.stringify(classification)
                ]
              );

              // Update email labels in database
              if (aiLabel && aiLabel !== 'Uncategorized') {
                await client.query(
                  `UPDATE emails SET labels = array_append(COALESCE(labels, '{}'), $1) WHERE id = $2`,
                  [aiLabel, emailId]
                );
              }

              totalClassified++;
              console.log(`  ✓ Classification: ${aiLabel}`);

              // Add delay between classifications to avoid rate limits
              await sleep(DELAY_BETWEEN_CLASSIFICATIONS);
            } catch (classifyError: any) {
              console.error(`  ❌ Classification failed for email ${emailId}:`, classifyError.message);
              // Continue with next email even if classification fails
              aiLabel = 'Uncategorized';
            }
          } else {
            // Already classified - get existing label
            const existingClassification = metaResult.rows[0].classification;
            if (existingClassification && existingClassification.suggested_label) {
              aiLabel = existingClassification.suggested_label;
            }
            console.log(`  ⊙ Already classified: ${aiLabel}`);
          }

          // Step 5: Set AI label on IMAP mailbox (if AI labeling is enabled)
          if (account.enable_ai_labeling && aiLabel && aiLabel !== 'Uncategorized') {
            console.log(`  🏷️  Setting label "${aiLabel}" on IMAP mailbox...`);

            const labelResult = await syncAILabelToImap(
              {
                imap_host: account.imap_host,
                imap_port: account.imap_port,
                imap_username: account.imap_username,
                imap_password_encrypted: account.imap_password_encrypted
              },
              messageId,
              aiLabel
            );

            if (labelResult.success) {
              console.log(`  ✓ Label set successfully on IMAP mailbox`);
              totalLabeled++;
            } else {
              console.log(`  ⚠️  Failed to set label: ${labelResult.error}`);
            }
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
