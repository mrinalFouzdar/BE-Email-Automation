import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

/**
 * Cleanup Script: Remove all IMAP accounts and their associated emails
 * Use this to test the complete flow from scratch
 */
async function cleanupImapData() {
  const client = new Client({ connectionString: connection });

  try {
    await client.connect();
    console.log('🔗 Connected to database\n');

    // Step 1: Count existing data
    console.log('📊 Current data count:');

    const imapAccountsCount = await client.query(`
      SELECT COUNT(*) as count FROM email_accounts WHERE provider_type = 'imap'
    `);
    console.log(`   - IMAP accounts: ${imapAccountsCount.rows[0].count}`);

    const imapEmailsCount = await client.query(`
      SELECT COUNT(*) as count FROM emails
      WHERE account_id IN (
        SELECT id FROM email_accounts WHERE provider_type = 'imap'
      )
    `);
    console.log(`   - Emails from IMAP accounts: ${imapEmailsCount.rows[0].count}`);

    const imapMetaCount = await client.query(`
      SELECT COUNT(*) as count FROM email_meta
      WHERE email_id IN (
        SELECT id FROM emails
        WHERE account_id IN (
          SELECT id FROM email_accounts WHERE provider_type = 'imap'
        )
      )
    `);
    console.log(`   - Email metadata from IMAP accounts: ${imapMetaCount.rows[0].count}`);

    const imapRemindersCount = await client.query(`
      SELECT COUNT(*) as count FROM reminders
      WHERE email_id IN (
        SELECT id FROM emails
        WHERE account_id IN (
          SELECT id FROM email_accounts WHERE provider_type = 'imap'
        )
      )
    `);
    console.log(`   - Reminders from IMAP emails: ${imapRemindersCount.rows[0].count}\n`);

    if (imapAccountsCount.rows[0].count === '0') {
      console.log('✓ No IMAP data found. Database is already clean!\n');
      await client.end();
      return;
    }

    // Step 2: Delete data in correct order (to avoid foreign key constraints)
    console.log('🗑️  Starting cleanup...\n');

    // 2.1: Delete reminders for IMAP emails
    const deleteReminders = await client.query(`
      DELETE FROM reminders
      WHERE email_id IN (
        SELECT id FROM emails
        WHERE account_id IN (
          SELECT id FROM email_accounts WHERE provider_type = 'imap'
        )
      )
    `);
    console.log(`   ✓ Deleted ${deleteReminders.rowCount} reminders`);

    // 2.2: Delete email metadata for IMAP emails
    const deleteMeta = await client.query(`
      DELETE FROM email_meta
      WHERE email_id IN (
        SELECT id FROM emails
        WHERE account_id IN (
          SELECT id FROM email_accounts WHERE provider_type = 'imap'
        )
      )
    `);
    console.log(`   ✓ Deleted ${deleteMeta.rowCount} email metadata records`);

    // 2.3: Delete emails from IMAP accounts
    const deleteEmails = await client.query(`
      DELETE FROM emails
      WHERE account_id IN (
        SELECT id FROM email_accounts WHERE provider_type = 'imap'
      )
    `);
    console.log(`   ✓ Deleted ${deleteEmails.rowCount} emails`);

    // 2.4: Delete IMAP accounts
    const deleteAccounts = await client.query(`
      DELETE FROM email_accounts WHERE provider_type = 'imap'
    `);
    console.log(`   ✓ Deleted ${deleteAccounts.rowCount} IMAP accounts`);

    console.log('\n✅ Cleanup completed successfully!');
    console.log('🧪 Database is now clean and ready for testing\n');

    await client.end();
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    process.exit(1);
  }
}

// Run the cleanup
cleanupImapData()
  .then(() => {
    console.log('✓ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
