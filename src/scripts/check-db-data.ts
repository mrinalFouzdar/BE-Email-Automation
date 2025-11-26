import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

async function checkDatabaseData() {
  const client = new Client({ connectionString: connection });

  try {
    await client.connect();
    console.log('🔗 Connected to database\n');

    // Check email accounts
    console.log('📧 EMAIL ACCOUNTS:');
    console.log('=' .repeat(80));
    const accounts = await client.query(`
      SELECT
        id,
        email,
        provider_type,
        status,
        auto_fetch,
        enable_ai_labeling,
        last_sync,
        created_at
      FROM email_accounts
      ORDER BY created_at DESC
    `);

    if (accounts.rows.length === 0) {
      console.log('   No accounts found\n');
    } else {
      accounts.rows.forEach(acc => {
        console.log(`   [${acc.id}] ${acc.email}`);
        console.log(`       Type: ${acc.provider_type.toUpperCase()}`);
        console.log(`       Status: ${acc.status}`);
        console.log(`       Auto-fetch: ${acc.auto_fetch}`);
        console.log(`       AI Labeling: ${acc.enable_ai_labeling}`);
        console.log(`       Last sync: ${acc.last_sync || 'Never'}`);
        console.log(`       Created: ${acc.created_at}`);
        console.log('');
      });
    }

    // Count emails by account type
    console.log('📊 EMAIL COUNT BY ACCOUNT TYPE:');
    console.log('=' .repeat(80));
    const emailCounts = await client.query(`
      SELECT
        ea.provider_type,
        COUNT(e.id) as email_count
      FROM email_accounts ea
      LEFT JOIN emails e ON e.account_id = ea.id
      GROUP BY ea.provider_type
    `);

    if (emailCounts.rows.length === 0) {
      console.log('   No data found\n');
    } else {
      emailCounts.rows.forEach(row => {
        console.log(`   ${row.provider_type.toUpperCase()}: ${row.email_count} emails`);
      });
      console.log('');
    }

    // Total counts
    console.log('📈 TOTAL COUNTS:');
    console.log('=' .repeat(80));
    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM email_accounts) as total_accounts,
        (SELECT COUNT(*) FROM email_accounts WHERE provider_type = 'imap') as imap_accounts,
        (SELECT COUNT(*) FROM email_accounts WHERE provider_type = 'gmail') as gmail_accounts,
        (SELECT COUNT(*) FROM emails) as total_emails,
        (SELECT COUNT(*) FROM email_meta) as total_classifications,
        (SELECT COUNT(*) FROM reminders) as total_reminders
    `);

    const stats = totals.rows[0];
    console.log(`   Total Accounts: ${stats.total_accounts}`);
    console.log(`   - IMAP Accounts: ${stats.imap_accounts}`);
    console.log(`   - Gmail Accounts: ${stats.gmail_accounts}`);
    console.log(`   Total Emails: ${stats.total_emails}`);
    console.log(`   Total Classifications: ${stats.total_classifications}`);
    console.log(`   Total Reminders: ${stats.total_reminders}`);
    console.log('');

    // Check if any data exists for IMAP accounts
    if (stats.imap_accounts > 0) {
      console.log('⚠️  WARNING: IMAP accounts found!');
      console.log('   Run "npm run cleanup:imap" to clean IMAP data before testing\n');
    } else {
      console.log('✅ No IMAP accounts found - Database is clean for testing!\n');
    }

    await client.end();
  } catch (error: any) {
    console.error('❌ Error checking database:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    process.exit(1);
  }
}

checkDatabaseData()
  .then(() => {
    console.log('✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });
