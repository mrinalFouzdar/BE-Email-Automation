"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOAuth = startOAuth;
exports.oauthCallback = oauthCallback;
const service = __importStar(require("./auth.service"));
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
async function startOAuth(_req, res) {
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
async function oauthCallback(req, res) {
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
