import { client } from '../../config/db';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { parseDate } from '../../utils/common';
dotenv.config();

export async function fetchFromGmail() {
  // get tokens
  const t = await client.query('SELECT access_token, refresh_token FROM oauth_tokens ORDER BY id DESC LIMIT 1');
  console.log("🚀 ~ fetchFromGmail ~ t:", t)
  if (t.rowCount === 0) throw new Error('No OAuth tokens found. Authorize first.');
  const { access_token, refresh_token } = t.rows[0];
  const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
  console.log("🚀 ~ fetchFromGmail ~ oAuth2Client:", oAuth2Client)
  oAuth2Client.setCredentials({ access_token, refresh_token });

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  console.log("🚀 ~ fetchFromGmail ~ gmail:", gmail)
  const list = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
  console.log("🚀 ~ fetchFromGmail ~ list:", list)
  if (!list.data.messages) return 0;
  let saved = 0;
  for (const m of list.data.messages) {
    const details = await gmail.users.messages.get({ userId: 'me', id: m.id! });
    console.log("🚀 ~ fetchFromGmail ~ details:", details)
    const headers = details.data.payload?.headers || [];
    console.log("🚀 ~ fetchFromGmail ~ headers:", headers)
    const subject = headers.find(h=>h.name==='Subject')?.value || '';
    const from = headers.find(h=>h.name==='From')?.value || '';
    const date = headers.find(h=>h.name==='Date')?.value || '';
    const to = headers.find(h=>h.name==='To')?.value || '';
    const cc = headers.find(h=>h.name==='Cc')?.value || '';
    console.log("🚀 ~ fetchFromGmail ~ date:", date)
    const receivedAt = parseDate(date);

    // Extract email addresses from To and Cc fields
    const extractEmails = (str: string): string[] => {
      if (!str) return [];
      const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
      return str.match(emailRegex) || [];
    };
    const toRecipients = extractEmails(to);
    const ccRecipients = extractEmails(cc);
    const allRecipients = [...toRecipients, ...ccRecipients];

    // Extract labels and check if unread
    const labels = details.data.labelIds || [];
    const isUnread = labels.includes('UNREAD');

    // body extraction (simplified)
    let body = '';
    if (details.data.payload?.parts) {
      const part = details.data.payload.parts.find(p => p.mimeType === 'text/plain');
      if (part?.body?.data) body = Buffer.from(part.body.data, 'base64').toString('utf8');
    } else if (details.data.payload?.body?.data) {
      body = Buffer.from(details.data.payload.body.data, 'base64').toString('utf8');
    }
    await client.query(
      `INSERT INTO emails(gmail_id, thread_id, sender_email, to_recipients, cc_recipients, recipients, subject, body, is_unread, labels, received_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (gmail_id) DO NOTHING`,
      [m.id, details.data.threadId || null, from, toRecipients, ccRecipients, allRecipients, subject, body, isUnread, labels, receivedAt]
    );
    saved++;
  }
  return saved;
}
