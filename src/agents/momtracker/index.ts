import dotenv from 'dotenv';
dotenv.config();
import { Client } from 'pg';
import OpenAI from 'openai';

const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
const client = new Client({ connectionString: connection });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function isMoMEmail(subject: string, body: string): Promise<boolean> {
  // First check with regex for common MoM patterns
  const momKeywords = /mom|minutes of meeting|minutes|meeting notes|meeting summary|action items|meeting recap/i;
  if (momKeywords.test(subject + ' ' + body)) {
    return true;
  }

  // Use OpenAI for more sophisticated detection
  try {
    const prompt = `Is this email a "Minutes of Meeting" (MoM) or meeting notes/summary email?

Subject: ${subject}
Body: ${body.substring(0, 500)}

A MoM email typically contains:
- Summary of what was discussed in a meeting
- Action items or decisions made
- Attendees list
- Meeting recap or notes

Respond with ONLY "true" or "false".`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10
    });

    const answer = response.choices[0].message.content?.toLowerCase().trim();
    return answer === 'true';
  } catch (error) {
    console.error('OpenAI error in isMoMEmail:', error);
    return false;
  }
}

function subjectsAreSimilar(subject1: string, subject2: string): boolean {
  // Remove common prefixes like Re:, Fwd:, etc.
  const clean = (s: string) => s.replace(/^(re:|fwd:|fw:)\s*/gi, '').toLowerCase().trim();
  const s1 = clean(subject1);
  const s2 = clean(subject2);

  // Check if subjects are similar (one contains the other or vice versa)
  return s1.includes(s2) || s2.includes(s1) || s1 === s2;
}

async function main() {
  await client.connect();
  console.log('Connected to DB for MoM Tracker');

  // Step 1: Identify and mark MoM emails
  const allEmails = await client.query(`
    SELECT e.id, e.subject, e.body, m.email_id, m.is_mom
    FROM emails e
    LEFT JOIN email_meta m ON m.email_id = e.id
    WHERE m.id IS NOT NULL
  `);

  console.log(`Checking ${allEmails.rows.length} emails for MoM content...`);

  for (const e of allEmails.rows) {
    const isMoM = await isMoMEmail(e.subject || '', e.body || '');

    if (isMoM) {
      await client.query(
        `UPDATE email_meta SET is_mom = true WHERE email_id = $1`,
        [e.id]
      );
      console.log(`✓ Marked email ${e.id} as MoM: "${e.subject?.substring(0, 50)}..."`);
    }
  }

  // Step 2: Find meetings and check if they have MoM
  const meetings = await client.query(`
    SELECT e.id, e.subject, e.thread_id, e.received_at, m.has_mom_received
    FROM emails e
    JOIN email_meta m ON m.email_id = e.id
    WHERE m.is_meeting = true
      AND m.has_mom_received IS NULL
    ORDER BY e.received_at DESC
  `);

  console.log(`\nTracking MoM for ${meetings.rows.length} meetings...`);

  for (const meeting of meetings.rows) {
    const meetingTime = new Date(meeting.received_at);
    const now = new Date();
    const hoursElapsed = (now.getTime() - meetingTime.getTime()) / (1000 * 60 * 60);

    // Look for MoM emails after this meeting (within 48 hours)
    const momEmails = await client.query(`
      SELECT e.id, e.subject
      FROM emails e
      JOIN email_meta m ON m.email_id = e.id
      WHERE m.is_mom = true
        AND e.received_at > $1
        AND e.received_at < $1 + INTERVAL '48 hours'
        AND (e.thread_id = $2 OR e.thread_id IS NULL)
      ORDER BY e.received_at ASC
    `, [meeting.received_at, meeting.thread_id]);

    // Check if any MoM has similar subject
    let momFound = null;
    for (const mom of momEmails.rows) {
      if (meeting.thread_id && mom.thread_id === meeting.thread_id) {
        momFound = mom;
        break;
      }
      if (subjectsAreSimilar(meeting.subject || '', mom.subject || '')) {
        momFound = mom;
        break;
      }
    }

    if (momFound) {
      // MoM found for this meeting
      await client.query(
        `UPDATE email_meta SET has_mom_received = true, related_meeting_id = $2 WHERE email_id = $1`,
        [meeting.id, momFound.id]
      );
      await client.query(
        `UPDATE email_meta SET related_meeting_id = $2 WHERE email_id = $1`,
        [momFound.id, meeting.id]
      );
      console.log(`✓ Meeting ${meeting.id} HAS MoM: ${momFound.subject?.substring(0, 50)}...`);
    } else if (hoursElapsed > 48) {
      // More than 48 hours passed, mark as no MoM received
      await client.query(
        `UPDATE email_meta SET has_mom_received = false WHERE email_id = $1`,
        [meeting.id]
      );
      console.log(`✗ Meeting ${meeting.id} MISSING MoM (${Math.round(hoursElapsed)}h elapsed)`);
    } else {
      console.log(`⏳ Meeting ${meeting.id} waiting for MoM (${Math.round(hoursElapsed)}h elapsed)`);
    }
  }

  await client.end();
  console.log('\n✓ Done MoM Tracker');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});