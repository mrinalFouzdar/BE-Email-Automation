import { database } from '../config/database.config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// List of all migrations in order
const MIGRATIONS = [
  'init.sql',
  'add_email_fields.sql',
  'add_accounts_table.sql',
  'add_imap_support.sql',
  'add_manual_oauth_support.sql',
  'add_users_table.sql',
  'add_user_id_to_accounts.sql',
  'add_labels_table.sql',
  'add_sender_name.sql',
  'add_email_meta_unique_constraint.sql',
  'add_user_roles.sql',
  'add_pending_label_suggestions.sql',
  'add_classifications_table.sql',
  'fix_missing_columns.sql',
  'add_emails_updated_at.sql',
];

async function runMigrations() {
  try {
    console.log('🔗 Connecting to database...');
    await database.connect();
    console.log('✅ Connected!\n');

    console.log('🔄 Running database migrations...\n');

    for (const migration of MIGRATIONS) {
      const migrationPath = path.resolve(__dirname, 'migrations', migration);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${migration} (skipping)`);
        continue;
      }

      console.log(`📄 Applying: ${migration}...`);
      const sql = fs.readFileSync(migrationPath, 'utf8');

      try {
        await database.getClient().query(sql);
        console.log(`   ✓ Success\n`);
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}\n`);
        // Continue with other migrations even if one fails
      }
    }

    console.log('✅ All migrations completed!\n');
  } catch (err: any) {
    console.error('❌ Migration error:', err.message);
    throw err;
  } finally {
    await database.disconnect();
    console.log('👋 Disconnected from database');
  }
}

runMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
