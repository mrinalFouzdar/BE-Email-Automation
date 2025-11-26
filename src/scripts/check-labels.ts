import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkLabels() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag'
  });

  await client.connect();

  console.log('\n📧 EMAILS WITH LABELS:\n');

  const result = await client.query(`
    SELECT e.id, e.subject, e.labels, e.sender_email, e.gmail_id,
           em.classification
    FROM emails e
    LEFT JOIN email_meta em ON e.id = em.email_id
    ORDER BY e.id DESC
    LIMIT 10
  `);

  result.rows.forEach(r => {
    console.log(`[${r.id}] ${r.subject?.substring(0, 50) || '(No subject)'}...`);
    console.log(`  From: ${r.sender_email}`);
    console.log(`  Gmail ID: ${r.gmail_id}`);
    console.log(`  Labels in DB: ${JSON.stringify(r.labels)}`);
    console.log(`  Classification: ${r.classification?.suggested_label || 'None'}`);
    console.log('');
  });

  await client.end();
}

checkLabels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
