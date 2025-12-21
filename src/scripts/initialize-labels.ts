import { db } from '../config/database.config';
import { initializeSystemLabelsInMailbox } from '../services/label/imap-label.service';

async function initializeLabelsForExistingAccounts() {
  try {
    console.log('🏷️ Initializing system labels for existing accounts...\n');

    const result = await db.query(`
      SELECT id, email, imap_host, imap_port, imap_user, imap_password
      FROM email_accounts
      WHERE imap_host IS NOT NULL AND imap_user IS NOT NULL
    `);

    const accounts = result.rows;
    console.log(`Found ${accounts.length} IMAP account(s)\n`);

    if (accounts.length === 0) {
      console.log('No IMAP accounts found.');
      process.exit(0);
    }

    for (const account of accounts) {
      console.log(`\n📧 Processing account: ${account.email}`);
      console.log(`   Host: ${account.imap_host}`);

      try {
        const labelResult = await initializeSystemLabelsInMailbox({
          imap_host: account.imap_host,
          imap_port: account.imap_port || 993,
          imap_username: account.imap_user,
          imap_password_encrypted: account.imap_password,
        });

        if (labelResult.success) {
          if (labelResult.created.length > 0) {
            console.log(`   ✅ Created labels: ${labelResult.created.join(', ')}`);
          } else {
            console.log(`   ℹ️  All labels already exist`);
          }
        } else {
          console.error(`   ❌ Failed to create some labels:`);
          labelResult.errors?.forEach(err => console.error(`      - ${err}`));
        }
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    console.log('\n✅ Label initialization complete!');
  } catch (error) {
    console.error('\n❌ Script failed:', error);
  } finally {
    process.exit(0);
  }
}

initializeLabelsForExistingAccounts();
