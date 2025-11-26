import dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';
// COMMENTED OUT - Using local LLM instead
// import OpenAI from 'openai';

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
const client = new Client({ connectionString: connection });
// COMMENTED OUT - Using local LLM instead
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

import { classifyEmail } from '../../services/classifier.service';

async function main() {
  await client.connect();
  console.log('Connected to DB for AI-Powered Classifier');

  const emails = await client.query(`
    SELECT e.* FROM emails e
    LEFT JOIN email_meta m ON m.email_id = e.id
    WHERE m.id IS NULL
    LIMIT 10
  `);

  console.log(`Found ${emails.rows.length} emails to classify`);

  for (const e of emails.rows) {
    const subject = e.subject || '';
    const body = e.body || '';
    const sender = e.sender_email || '';

    console.log(`Classifying email ${e.id}: "${subject.substring(0, 50)}..."`);

    const classification = await classifyEmail(subject, body, sender);

    // 1. Insert metadata
    await client.query(
      `INSERT INTO email_meta(email_id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, classification)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        e.id,
        classification.is_meeting,
        classification.is_escalation,
        classification.is_hierarchy,
        classification.is_client,
        classification.is_urgent,
        JSON.stringify(classification)
      ]
    );

    // 2. Update email labels if a label was suggested
    if (classification.suggested_label && classification.suggested_label !== 'Uncategorized') {
      await client.query(
        `UPDATE emails SET labels = array_append(COALESCE(labels, '{}'), $1) WHERE id = $2`,
        [classification.suggested_label, e.id]
      );
    }

    console.log(`✓ Classified email ${e.id}:`, {
      hierarchy: classification.is_hierarchy,
      client: classification.is_client,
      meeting: classification.is_meeting,
      escalation: classification.is_escalation,
      urgent: classification.is_urgent,
      label: classification.suggested_label
    });
  }

  await client.end();
  console.log('Done AI-Powered Classifier');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});