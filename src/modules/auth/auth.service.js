"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthUrl = createAuthUrl;
exports.handleCallback = handleCallback;
const google_auth_library_1 = require("google-auth-library");
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../../config/db");
dotenv_1.default.config();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:4000/auth/callback';
function createAuthUrl() {
    const o = new google_auth_library_1.OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    return o.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify', 'openid', 'email', 'profile'],
        prompt: 'consent'
    });
}
async function handleCallback(code) {
    const o = new google_auth_library_1.OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const r = await o.getToken(code);
    const tokens = r.tokens;
    await db_1.client.query(`INSERT INTO oauth_tokens(access_token, refresh_token, scope, token_type, expiry)
     VALUES($1,$2,$3,$4,$5)`, [tokens.access_token || null, tokens.refresh_token || null, tokens.scope || null, tokens.token_type || null, tokens.expiry_date ? new Date(tokens.expiry_date) : null]);
    return tokens;
}
