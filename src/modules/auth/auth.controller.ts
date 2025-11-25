import { Request, Response } from 'express';
import * as service from './auth.service';

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
export async function startOAuth(_req: Request, res: Response) {
  const url = service.createAuthUrl();
  console.log("🚀 ~ startOAuth ~ url:", url)
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
export async function oauthCallback(req: Request, res: Response) {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');
  try {
    const tokens = await service.handleCallback(code);
    res.send('OAuth success. Tokens stored. You can close this window.');
  } catch (err) {
    console.error('OAuth callback error', err);
    res.status(500).send('OAuth failed');
  }
}
