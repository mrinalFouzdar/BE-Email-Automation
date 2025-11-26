import { client } from '../../config/db';
// COMMENTED OUT - Using local LLM instead of OpenAI
// import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// COMMENTED OUT - Using local LLM instead
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function classifyUnprocessed() {
  const emails = await client.query(`
    SELECT e.* FROM emails e
    LEFT JOIN email_meta m ON m.email_id = e.id
    WHERE m.id IS NULL
    LIMIT 20
  `);
  for (const e of emails.rows) {
    const subject = e.subject || '';
    const body = e.body || '';
    const is_meeting = /meeting|meet|call/i.test(subject+body);
    const is_escalation = /asap|urgent|immediately|escalation/i.test(subject+body);
    const is_hierarchy = /boss|manager|director|ceo/i.test(subject+body);
    const is_client = /client|customer|vendor/i.test(subject+body);
    const is_urgent = is_escalation || /urgent/i.test(subject+body);
    // COMMENTED OUT - OpenAI embeddings (using local LLM instead)
    // get embedding
    let embedding = null;
    // try {
    //   const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: subject + '\n\n' + body });
    //   embedding = resp.data[0].embedding;
    //   console.log("🚀 ~ classifyUnprocessed ~ embedding:", embedding)
    // } catch (err) {
    //   console.warn('Embedding failed', err);
    // }

    // Note: Embeddings disabled for now (was using OpenAI)
    // Can implement local embeddings later if needed
    await client.query(
      `INSERT INTO email_meta(email_id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, classification, embedding)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [e.id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, JSON.stringify({subject}), embedding]
    );
  }
  return emails.rowCount;
}
