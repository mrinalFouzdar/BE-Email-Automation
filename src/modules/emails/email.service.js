import { client } from '../../config/db';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import { parseDate } from '../../utils/common';
import { getAccountById } from '../accounts/account.service';
import { decryptPassword } from '../../services/encryption.service';
import { processEmailsForAccount } from '../../emailProcessor';
dotenv.config();
/**
 * Fetch emails using Gmail API.
 * If `accountId` is provided, load account from DB and use its credentials (or fallback to IMAP processing).
 * If no `accountId` provided, fallback to legacy global oauth_tokens table.
 */
export async function fetchFromGmail(accountId) {
    console.log("🚀 ~ fetchFromGmail ~ accountId:", accountId);
    // If an accountId is provided, prefer account-specific handling
    if (accountId) {
        const acct = await getAccountById(accountId);
        console.log("🚀 ~ fetchFromGmail ~ acct:", acct);
        // if (!acct) throw new Error(`Account id=${accountId} not found`);
        // If account has IMAP credentials, reuse IMAP processor
        if ((acct.provider_type === 'imap') || acct.imap_password_encrypted) {
            await processEmailsForAccount(acct);
            return 0;
        }
        // Gmail account with stored OAuth client + refresh token
        if (acct.provider_type === 'gmail' && acct.oauth_client_id && acct.oauth_client_secret_encrypted && acct.oauth_refresh_token_encrypted) {
            const clientId = acct.oauth_client_id;
            let clientSecret;
            let refreshToken;
            try {
                clientSecret = decryptPassword(acct.oauth_client_secret_encrypted);
                refreshToken = decryptPassword(acct.oauth_refresh_token_encrypted);
            }
            catch (err) {
                throw new Error(`Failed to decrypt OAuth credentials for account ${acct.email}: ${err}`);
            }
            const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, process.env.GMAIL_REDIRECT_URI);
            oAuth2Client.setCredentials({ refresh_token: refreshToken });
            const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
            const list = await gmail.users.messages.list({ userId: 'me', maxResults: 50 });
            if (!list.data.messages)
                return 0;
            let saved = 0;
            for (const m of list.data.messages) {
                const details = await gmail.users.messages.get({ userId: 'me', id: m.id });
                const headers = details.data.payload?.headers || [];
                const subject = headers.find(h => h.name === 'Subject')?.value || '';
                const from = headers.find(h => h.name === 'From')?.value || '';
                const date = headers.find(h => h.name === 'Date')?.value || '';
                const to = headers.find(h => h.name === 'To')?.value || '';
                const cc = headers.find(h => h.name === 'Cc')?.value || '';
                const receivedAt = parseDate(date);
                const extractEmails = (str) => {
                    if (!str)
                        return [];
                    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
                    return str.match(emailRegex) || [];
                };
                const toRecipients = extractEmails(to);
                const ccRecipients = extractEmails(cc);
                const allRecipients = [...toRecipients, ...ccRecipients];
                const labels = details.data.labelIds || [];
                const isUnread = labels.includes('UNREAD');
                let body = '';
                if (details.data.payload?.parts) {
                    const part = details.data.payload.parts.find(p => p.mimeType === 'text/plain');
                    if (part?.body?.data)
                        body = Buffer.from(part.body.data, 'base64').toString('utf8');
                }
                else if (details.data.payload?.body?.data) {
                    body = Buffer.from(details.data.payload.body.data, 'base64').toString('utf8');
                }
                await client.query(`INSERT INTO emails(gmail_id, thread_id, sender_email, to_recipients, cc_recipients, recipients, subject, body, is_unread, labels, received_at, account_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (gmail_id) DO NOTHING`, [m.id, details.data.threadId || null, from, toRecipients, ccRecipients, allRecipients, subject, body, isUnread, labels, receivedAt, acct.id]);
                saved++;
            }
            return saved;
        }
        // Not able to handle this account type here
        throw new Error(`Account ${acct.email} cannot be fetched via Gmail API from this function`);
    }
    // Legacy path: global oauth_tokens table
    const t = await client.query('SELECT access_token, refresh_token FROM oauth_tokens ORDER BY id DESC LIMIT 1');
    // console.log("🚀 ~ fetchFromGmail ~ t:", t)
    if (t.rowCount === 0)
        throw new Error('No OAuth tokens found. Authorize first.');
    const { access_token, refresh_token } = t.rows[0];
    const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GMAIL_REDIRECT_URI);
    oAuth2Client.setCredentials({ access_token, refresh_token });
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 20 });
    if (!list.data.messages)
        return 0;
    let saved = 0;
    for (const m of list.data.messages) {
        const details = await gmail.users.messages.get({ userId: 'me', id: m.id });
        const headers = details.data.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const cc = headers.find(h => h.name === 'Cc')?.value || '';
        const receivedAt = parseDate(date);
        const extractEmails = (str) => {
            if (!str)
                return [];
            const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
            return str.match(emailRegex) || [];
        };
        const toRecipients = extractEmails(to);
        const ccRecipients = extractEmails(cc);
        const allRecipients = [...toRecipients, ...ccRecipients];
        const labels = details.data.labelIds || [];
        const isUnread = labels.includes('UNREAD');
        let body = '';
        if (details.data.payload?.parts) {
            const part = details.data.payload.parts.find(p => p.mimeType === 'text/plain');
            if (part?.body?.data)
                body = Buffer.from(part.body.data, 'base64').toString('utf8');
        }
        else if (details.data.payload?.body?.data) {
            body = Buffer.from(details.data.payload.body.data, 'base64').toString('utf8');
        }
        await client.query(`INSERT INTO emails(gmail_id, thread_id, sender_email, to_recipients, cc_recipients, recipients, subject, body, is_unread, labels, received_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (gmail_id) DO NOTHING`, [m.id, details.data.threadId || null, from, toRecipients, ccRecipients, allRecipients, subject, body, isUnread, labels, receivedAt]);
        saved++;
    }
    return saved;
}
