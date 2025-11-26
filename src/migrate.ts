import { client, connect } from './config/db';
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
  'add_manual_oauth_support.sql'
];

export async function runMigrations(standalone = true) {
  try {
    if (standalone) {
      await connect();
    }

    console.log('🔄 Running database migrations...');

    for (const migration of MIGRATIONS) {
      const migrationPath = path.resolve(__dirname, '../migrations', migration);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Migration file not found: ${migration} (skipping)`);
        continue;
      }

      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log(`✓ Applied migration: ${migration}`);
    }

    console.log('✅ All migrations completed successfully');
  } catch (err) {
    console.error('❌ Migration error:', err);
    throw err;
  } finally {
    if (standalone) {
      await client.end();
    }
  }
}

// Run migrations if this file is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  runMigrations(true).then(() => {
    process.exit(0);
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
