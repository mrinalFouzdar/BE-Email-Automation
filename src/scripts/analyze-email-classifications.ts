import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeEmailClassifications() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get sample emails with their classifications
    const result = await client.query(`
      SELECT
        e.id,
        e.subject,
        e.sender_email,
        LEFT(e.body, 300) as body_preview,
        em.classification->>'suggested_label' as suggested_label,
        em.classification->>'reasoning' as reasoning
      FROM emails e
      LEFT JOIN email_meta em ON e.id = em.email_id
      ORDER BY e.created_at DESC
      LIMIT 15
    `);

    console.log('📧 Sample Emails and Their Classifications:\n');
    console.log('='.repeat(80));

    result.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. Subject: ${row.subject}`);
      console.log(`   From: ${row.sender_email}`);
      console.log(`   Label: ${row.suggested_label || 'NOT CLASSIFIED'}`);
      if (row.reasoning) {
        console.log(`   Reasoning: ${row.reasoning.substring(0, 100)}...`);
      }
      if (row.body_preview) {
        console.log(`   Body: ${row.body_preview.replace(/\n/g, ' ').substring(0, 150)}...`);
      }
      console.log('-'.repeat(80));
    });

    // Get label distribution
    const labelStats = await client.query(`
      SELECT
        em.classification->>'suggested_label' as label,
        COUNT(*) as count
      FROM email_meta em
      WHERE em.classification IS NOT NULL
      GROUP BY em.classification->>'suggested_label'
      ORDER BY count DESC
    `);

    console.log('\n\n📊 Label Distribution:\n');
    console.log('='.repeat(80));
    labelStats.rows.forEach(row => {
      console.log(`   ${row.label || 'NULL'}: ${row.count} emails`);
    });

    await client.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeEmailClassifications();
