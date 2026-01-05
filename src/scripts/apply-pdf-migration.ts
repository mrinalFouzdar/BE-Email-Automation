import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

async function applyMigration() {
  const client = new Client({ connectionString: connection });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Read the PDF attachments migration
    const migrationPath = path.resolve(__dirname, '../database/migrations/add_pdf_attachments.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Applying PDF attachments migration...\n');
    await client.query(sql);

    console.log('✅ Migration applied successfully!');
    console.log('✅ email_attachments table created');

    await client.end();
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration();
