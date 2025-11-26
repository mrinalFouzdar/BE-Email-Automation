import dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
const client = new Client({ connectionString: connection });

async function main() {
  await client.connect();
  console.log('Connected to DB');

  // Update first 5 emails with "Work"
  await client.query(`
    UPDATE emails 
    SET labels = '{"Work", "Important"}' 
    WHERE id IN (SELECT id FROM emails ORDER BY id LIMIT 5)
  `);
  console.log('Updated 5 emails with Work, Important');

  // Update next 5 emails with "Personal"
  await client.query(`
    UPDATE emails 
    SET labels = '{"Personal"}' 
    WHERE id IN (SELECT id FROM emails ORDER BY id OFFSET 5 LIMIT 5)
  `);
  console.log('Updated 5 emails with Personal');

  await client.end();
}

main().catch(console.error);
