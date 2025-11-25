import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { client } from '../../config/db';
dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:4000/auth/callback';

export function createAuthUrl() {
  const o = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  return o.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.modify','openid','email','profile'],
    prompt: 'consent'
  });
}

export async function handleCallback(code: string) {
  const o = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const r = await o.getToken(code);
  const tokens = r.tokens;
  await client.query(
    `INSERT INTO oauth_tokens(access_token, refresh_token, scope, token_type, expiry)
     VALUES($1,$2,$3,$4,$5)`,
    [tokens.access_token || null, tokens.refresh_token || null, tokens.scope || null, tokens.token_type || null, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
  );
  return tokens;
}
