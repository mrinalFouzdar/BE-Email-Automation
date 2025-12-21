import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Run initial setup migration
    console.log('\n📦 Running Initial Setup Migration...');
    const migration = fs.readFileSync(
      path.join(__dirname, 'src/database/migrations/00_initial_setup.sql'),
      'utf8'
    );
    await client.query(migration);
    console.log('✅ Initial setup completed');

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Create admin user');
    console.log('2. Add email accounts');
    console.log('3. Start the application');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
