import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { client } from '../../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userService } from '../users/user.service.js';
import { JWT_SECRET } from '../../config/passport.js';
dotenv.config();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:4000/auth/callback';
const SALT_ROUNDS = 10;
export function createAuthUrl() {
    const o = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    return o.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.modify', 'openid', 'email', 'profile'],
        prompt: 'consent'
    });
}
export async function handleCallback(code) {
    const o = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    const r = await o.getToken(code);
    const tokens = r.tokens;
    await client.query(`INSERT INTO oauth_tokens(access_token, refresh_token, scope, token_type, expiry)
     VALUES($1,$2,$3,$4,$5)`, [tokens.access_token || null, tokens.refresh_token || null, tokens.scope || null, tokens.token_type || null, tokens.expiry_date ? new Date(tokens.expiry_date) : null]);
    return tokens;
}
export async function register(userData) {
    const existingUser = await userService.findByEmail(userData.email);
    if (existingUser) {
        throw new Error('User with this email already exists');
    }
    const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);
    const user = await userService.create({
        ...userData,
        password: hashedPassword,
    });
    const userWithoutPassword = userService.removePassword(user);
    const token = generateToken(userWithoutPassword);
    return { user: userWithoutPassword, token };
}
export function generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
