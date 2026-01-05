import { Client } from 'pg';
import dotenv from 'dotenv';
import { fetchEmailsViaImap } from '../services/email/imap-email.service.js';
import { EmailProcessingService } from '../services/email/email-processing.service';
import { pdfProcessingService } from '../services/pdf/pdf-processing.service.js';
import { embeddingService } from '../services/ai/embedding.service.js';

dotenv.config();

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

/**
 * Manual Email Sync Script
 *
 * Fetches exactly 5 emails from all IMAP accounts
 * Processes PDFs and generates vector embeddings
 * Makes data available for RAG-based chat
 *
 * Run: npm run sync:emails
 */
export async function syncEmailsManually() {
  const client = new Client({ connectionString: connection });
  const emailProcessingService = new EmailProcessingService();

  try {
    await client.connect();
    console.log('\n========================================');
    console.log('📧 MANUAL EMAIL SYNC - 5 Emails per Account');
    console.log(`⏰ Time: ${new Date().toISOString()}`);
    console.log('========================================\n');

    // Get all active IMAP accounts
    const accountsResult = await client.query(`
      SELECT
        id,
        email,
        account_name,
        imap_host,
        imap_port,
        imap_username,
        imap_password_encrypted,
        enable_ai_labeling,
        user_id
      FROM email_accounts
      WHERE provider = 'imap'
        AND status = 'connected'
    `);

    const accounts = accountsResult.rows;
    console.log(`📧 Found ${accounts.length} IMAP accounts\n`);

    if (accounts.length === 0) {
      console.log('⚠️  No IMAP accounts found. Please add an IMAP account first.');
      console.log('   You can add accounts via the frontend or API.');
      await client.end();
      return;
    }

    let totalProcessed = 0;
    let totalNewEmails = 0;
    let totalPDFs = 0;
    let totalEmbeddings = 0;

    // Process each IMAP account
    for (const account of accounts) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📬 Processing Account: ${account.email}`);
      console.log(`   User ID: ${account.user_id}`);
      console.log(`${'='.repeat(60)}`);

      try {
        // Fetch exactly 5 emails from IMAP
        const imapConfig = {
          host: account.imap_host,
          port: account.imap_port,
          username: account.imap_username,
          encryptedPassword: account.imap_password_encrypted
        };

        console.log(`  📥 Fetching 5 recent emails from IMAP...`);
        let emails;
        try {
          emails = await fetchEmailsViaImap(imapConfig, 5); // Fetch exactly 5 emails
          console.log(`  ✅ Successfully fetched ${emails.length} emails from IMAP\n`);
        } catch (fetchError: any) {
          console.error(`  ❌ Failed to fetch emails from IMAP: ${fetchError.message}`);
          continue; // Skip this account
        }

        totalProcessed += emails.length;

        // Process each email
        for (let i = 0; i < emails.length; i++) {
          const email = emails[i];
          const messageId = email.messageId;

          console.log(`  [${i + 1}/${emails.length}] Processing: "${email.subject.substring(0, 60)}..."`);

          // Check if email already exists
          const existingEmail = await client.query(
            'SELECT id, gmail_id FROM emails WHERE gmail_id = $1 OR gmail_id LIKE $2',
            [messageId, `%${messageId}%`]
          );

          let emailId: number;
          let isNewEmail = false;

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
                messageId,
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
            isNewEmail = true;
            totalNewEmails++;
            console.log(`     ✓ Stored new email (ID: ${emailId})`);
          } else {
            emailId = existingEmail.rows[0].id;
            console.log(`     ⊙ Email already exists (ID: ${emailId}) - checking embeddings...`);
          }

          // Process PDF Attachments (only if email is new or PDF doesn't exist)
          if (email.attachments && email.attachments.length > 0) {
            console.log(`     📎 Found ${email.attachments.length} PDF attachment(s)...`);
            for (const attachment of email.attachments) {
              try {
                // Check if PDF already exists with embedding
                const existingPDF = await client.query(
                  'SELECT id, embedding FROM email_attachments WHERE email_id = $1 AND filename = $2',
                  [emailId, attachment.filename]
                );

                if (existingPDF.rows.length === 0) {
                  // PDF doesn't exist - process and store it
                  console.log(`        📄 Processing PDF: ${attachment.filename}...`);
                  const processedPDF = await pdfProcessingService.processPDFAttachment(attachment);
                  await pdfProcessingService.storePDFAttachment(emailId, processedPDF, attachment.content);
                  totalPDFs++;
                  console.log(`        ✓ Stored PDF with vector embedding`);
                } else if (!existingPDF.rows[0].embedding) {
                  // PDF exists but no embedding - generate embedding
                  console.log(`        🔄 PDF exists but missing embedding, generating...`);
                  const processedPDF = await pdfProcessingService.processPDFAttachment(attachment);

                  // Generate embedding only
                  const embeddingResult = await embeddingService.generateEmbedding(processedPDF.text);
                  if (embeddingResult) {
                    const embeddingStr = `[${embeddingResult.embedding.join(',')}]`;
                    await client.query(
                      'UPDATE email_attachments SET embedding = $1::vector, embedding_model = $2 WHERE id = $3',
                      [embeddingStr, embeddingResult.model, existingPDF.rows[0].id]
                    );
                    totalPDFs++;
                    console.log(`        ✓ Added missing embedding`);
                  }
                } else {
                  console.log(`        ⊙ PDF already exists with embedding: ${attachment.filename}`);
                }
              } catch (pdfError: any) {
                console.error(`        ❌ Failed to process PDF ${attachment.filename}: ${pdfError.message}`);
              }
            }
          }

          // Process Email (Classify + Generate Embedding + Assign Labels)
          // Only process if email is new OR embedding doesn't exist
          try {
            // Check if embedding already exists
            const existingMeta = await client.query(
              'SELECT id, embedding, embedding_model FROM email_meta WHERE email_id = $1',
              [emailId]
            );

            const hasEmbedding = existingMeta.rows.length > 0 && existingMeta.rows[0].embedding;

            if (isNewEmail) {
              // New email - full processing (classify + embed + label)
              console.log(`     🧠 Processing new email (AI classification + vector embedding)...`);
              await emailProcessingService.processEmail(emailId, client);
              totalEmbeddings++;
              console.log(`     ✅ Email vectorized & classified\n`);
            } else if (!hasEmbedding) {
              // Email exists but missing embedding - generate it
              console.log(`     🔄 Email exists but missing embedding, generating...`);
              await emailProcessingService.processEmail(emailId, client);
              totalEmbeddings++;
              console.log(`     ✅ Added missing embedding\n`);
            } else {
              // Email and embedding already exist - skip
              console.log(`     ⊙ Email already vectorized (model: ${existingMeta.rows[0].embedding_model})\n`);
            }
          } catch (processError: any) {
            console.error(`     ❌ Failed to process email: ${processError.message}\n`);
          }
        }

        // Update last_sync timestamp
        await client.query(
          'UPDATE email_accounts SET last_sync_at = NOW() WHERE id = $1',
          [account.id]
        );

        console.log(`✅ Completed processing for ${account.email}`);
      } catch (error: any) {
        console.error(`❌ Error processing account ${account.email}:`, error.message);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ MANUAL EMAIL SYNC COMPLETED');
    console.log('='.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   • Accounts processed: ${accounts.length}`);
    console.log(`   • Total emails fetched: ${totalProcessed}`);
    console.log(`   • New emails stored: ${totalNewEmails}`);
    console.log(`   • PDFs vectorized: ${totalPDFs}`);
    console.log(`   • Emails vectorized: ${totalEmbeddings}`);
    console.log('='.repeat(60));
    console.log('\n💬 Data is now available for RAG-based chat!');
    console.log('   Test it using: npm run demo:chat');
    console.log('   Or via API: POST /api/v1/chat');
    console.log('');

    await client.end();
  } catch (error: any) {
    console.error('❌ Manual Email Sync Error:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  syncEmailsManually()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}
