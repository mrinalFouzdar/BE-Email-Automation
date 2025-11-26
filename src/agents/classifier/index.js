import dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';
import OpenAI from 'openai';
const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
const client = new Client({ connectionString: connection });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
async function classifyEmail(subject, body, sender) {
    const prompt = `Analyze this email and classify it according to these categories:

Email Details:
- From: ${sender}
- Subject: ${subject}
- Body: ${body.substring(0, 1000)}

Classification Categories (respond with true/false for each):
1. is_hierarchy: Is this from someone in a management/leadership position (boss, manager, director, CEO, VP, senior leadership)?
2. is_client: Is this from an external client, customer, vendor, or partner?
3. is_meeting: Does this email discuss or schedule a meeting, call, or discussion?
4. is_escalation: Does this email have an escalation tone (urgent concerns, issues raised, problems needing attention)?
5. is_urgent: Does the sender request urgent action or immediate response (ASAP, urgent, deadline mentioned)?

Respond ONLY with valid JSON in this format:
{
  "is_hierarchy": true/false,
  "is_client": true/false,
  "is_meeting": true/false,
  "is_escalation": true/false,
  "is_urgent": true/false,
  "reasoning": "brief explanation"
}`;
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            response_format: { type: 'json_object' }
        });
        const result = JSON.parse(response.choices[0].message.content || '{}');
        return result;
    }
    catch (error) {
        console.error('OpenAI classification error:', error);
        // Fallback to basic regex if OpenAI fails
        const text = (subject + ' ' + body).toLowerCase();
        return {
            is_hierarchy: /boss|manager|director|ceo|vp|leadership/i.test(text),
            is_client: /client|customer|vendor|partner/i.test(text),
            is_meeting: /meeting|meet|call|discussion|schedule/i.test(text),
            is_escalation: /escalation|issue|problem|concern|critical/i.test(text),
            is_urgent: /asap|urgent|immediately|deadline|critical/i.test(text),
            reasoning: 'Fallback regex classification due to API error'
        };
    }
}
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
        await client.query(`INSERT INTO email_meta(email_id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, classification)
       VALUES($1,$2,$3,$4,$5,$6,$7)`, [
            e.id,
            classification.is_meeting,
            classification.is_escalation,
            classification.is_hierarchy,
            classification.is_client,
            classification.is_urgent,
            JSON.stringify(classification)
        ]);
        console.log(`✓ Classified email ${e.id}:`, {
            hierarchy: classification.is_hierarchy,
            client: classification.is_client,
            meeting: classification.is_meeting,
            escalation: classification.is_escalation,
            urgent: classification.is_urgent
        });
    }
    await client.end();
    console.log('Done AI-Powered Classifier');
}
main().catch(e => {
    console.error(e);
    process.exit(1);
});
