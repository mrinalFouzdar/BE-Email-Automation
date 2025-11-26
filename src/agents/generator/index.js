import dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';
const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
const client = new Client({ connectionString: connection });
async function main() {
    await client.connect();
    console.log('Connected to DB for Generator');
    const emails = await client.query(`
    SELECT e.* FROM emails e
    LEFT JOIN email_meta m ON m.email_id = e.id
    WHERE m.id IS NULL
    LIMIT 10
  `);
    for (const e of emails.rows) {
        const subject = e.subject || '';
        const body = e.body || '';
        const is_meeting = /meeting|meet|call/i.test(subject + body);
        const is_escalation = /asap|urgent|immediately|escalation/i.test(subject + body);
        const is_hierarchy = /boss|manager|director|ceo/i.test(subject + body);
        const is_client = /client|customer|vendor/i.test(subject + body);
        const is_urgent = is_escalation || /urgent/i.test(subject + body);
        await client.query(`INSERT INTO email_meta(email_id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, classification)
       VALUES($1,$2,$3,$4,$5,$6,$7)`, [e.id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, JSON.stringify({ subject })]);
        console.log('Classified email', e.id);
    }
    await client.end();
    console.log('Done Generator');
}
main().catch(e => { console.error(e); process.exit(1); });
