import * as service from './auth.service.js';
import { passport } from '../../config/passport.js';
/**
 * @swagger
 * /oauth2/auth/google:
 *   get:
 *     summary: Start Gmail OAuth flow
 *     description: Redirects to Google OAuth consent screen for Gmail authorization
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
export async function startOAuth(_req, res) {
    const url = service.createAuthUrl();
    console.log("🚀 ~ startOAuth ~ url:", url);
    res.redirect(url);
}
/**
 * @swagger
 * /oauth2/callback:
 *   get:
 *     summary: OAuth callback handler
 *     description: Google OAuth callback endpoint that stores access tokens
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *     responses:
 *       200:
 *         description: OAuth success
 *       400:
 *         description: Missing authorization code
 *       500:
 *         description: OAuth failed
 */
export async function oauthCallback(req, res) {
    const code = req.query.code;
    if (!code)
        return res.status(400).send('Missing code');
    try {
        const tokens = await service.handleCallback(code);
        res.send('OAuth success. Tokens stored. You can close this window.');
    }
    catch (err) {
        console.error('OAuth callback error', err);
        res.status(500).send('OAuth failed');
    }
}
export async function register(req, res) {
    try {
        const userData = req.body;
        if (!userData.email || !userData.password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const result = await service.register(userData);
        res.status(201).json({
            message: 'Registration successful',
            user: result.user,
            token: result.token,
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ message: error.message || 'Registration failed' });
    }
}
export function login(req, res, next) {
    passport.authenticate('local', { session: false }, (err, user, info) => {
        if (err) {
            return res.status(500).json({ message: 'Authentication error' });
        }
        if (!user) {
            return res.status(401).json({ message: info?.message || 'Invalid credentials' });
        }
        const token = service.generateToken(user);
        res.json({
            message: 'Login successful',
            user,
            token,
        });
    })(req, res, next);
}
