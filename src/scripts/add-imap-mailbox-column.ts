import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

async function addImapMailboxColumn() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Add imap_mailbox column
    await client.query(`
      ALTER TABLE emails
      ADD COLUMN IF NOT EXISTS imap_mailbox VARCHAR(255);
    `);
    console.log('✓ Added imap_mailbox column');

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_emails_imap_mailbox
      ON emails(imap_mailbox);
    `);
    console.log('✓ Created index on imap_mailbox');

    // Add comment
    await client.query(`
      COMMENT ON COLUMN emails.imap_mailbox IS
      'IMAP mailbox where the UID is valid (e.g., INBOX, [Gmail]/All Mail)';
    `);
    console.log('✓ Added column comment');

    // Verify
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'emails'
        AND column_name IN ('imap_uid', 'imap_mailbox')
      ORDER BY column_name;
    `);

    console.log('\n📊 Verification:');
    console.table(result.rows);

    await client.end();
    console.log('\n✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    process.exit(1);
  }
}

addImapMailboxColumn();
