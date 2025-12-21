import { database } from '../config/database.config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils';

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
  'add_label_embeddings.sql',
  'add_classifications_table.sql',
  'fix_missing_columns.sql',
  'add_emails_updated_at.sql',
  'add_token_usage_stats.sql',
];

export async function runMigrations(standalone = true) {
  try {
    if (standalone) {
      await database.connect();
    }

    logger.info('🔄 Running database migrations...');

    for (const migration of MIGRATIONS) {
      const migrationPath = path.resolve(__dirname, 'migrations', migration);

      if (!fs.existsSync(migrationPath)) {
        logger.warn(`Migration file not found: ${migration} (skipping)`);
        continue;
      }

      const sql = fs.readFileSync(migrationPath, 'utf8');
      await database.getClient().query(sql);
      logger.info(`✓ Applied migration: ${migration}`);
    }

    logger.info('✅ All migrations completed successfully');
  } catch (err) {
    logger.error('Migration error', err);
    throw err;
  } finally {
    if (standalone) {
      await database.disconnect();
    }
  }
}

// Run migrations if this file is executed directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  runMigrations(true)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}
