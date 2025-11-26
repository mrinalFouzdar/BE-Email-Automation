import { Client } from 'pg';
import dotenv from 'dotenv';
import { fetchEmailsViaImap } from '../services/imap-email.service.js';
import { classifyEmail } from '../services/classifier.service';
import { syncAILabelToImap } from '../services/imap-label.service';
import { syncAILabelsToGmail } from '../services/gmail-label.service';
import { sleep } from '../utils/rate-limiter';

dotenv.config();

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

// Configuration
const MAX_EMAILS_PER_BATCH = 50; // Process max 50 emails per sync
const DELAY_BETWEEN_CLASSIFICATIONS = 500; // 500ms delay between API calls

/**
 * Sync emails for a single IMAP account
 * Used when a new account is added or manual sync is triggered
 * @param accountId - ID of the email account to sync
 */
export async function syncSingleImapAccount(accountId: number) {
  const client = new Client({ connectionString: connection });

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

    // Fetch unread emails from IMAP
    const imapConfig = {
      host: account.imap_host,
      port: account.imap_port,
      username: account.imap_username,
      encryptedPassword: account.imap_password_encrypted
    };

    console.log(`📥 Fetching unread emails from IMAP...`);
    const emails = await fetchEmailsViaImap(imapConfig, MAX_EMAILS_PER_BATCH);
    console.log(`✓ Fetched ${emails.length} emails`);

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
        newEmails++;
        console.log(`  ✓ Stored new email: "${email.subject.substring(0, 50)}..."`);
      } else {
        emailId = existingEmail.rows[0].id;
        console.log(`  ⊙ Email already exists: "${email.subject.substring(0, 50)}..."`);
      }

      // Check if email already has classification
      const metaResult = await client.query(
        'SELECT id, classification FROM email_meta WHERE email_id = $1',
        [emailId]
      );

      let aiLabel: string | null = null;

      if (metaResult.rows.length === 0) {
        // No classification yet - send to AI model
        console.log(`  🤖 Classifying email ${emailId} with AI... (${classified + 1}/${emails.length})`);

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

          classified++;
          console.log(`  ✓ Classification: ${aiLabel}`);

          // Add delay between classifications to avoid rate limits
          if (classified < emails.length) {
            await sleep(DELAY_BETWEEN_CLASSIFICATIONS);
          }
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

      // Set AI label on IMAP mailbox (if AI labeling is enabled)
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
          labeled++;
        } else {
          console.log(`  ⚠️  Failed to set label: ${labelResult.error}`);
        }
      }
    }

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
