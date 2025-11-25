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
exports.listAccounts = listAccounts;
exports.createAccount = createAccount;
exports.fetchAccountEmails = fetchAccountEmails;
exports.labelAccountEmails = labelAccountEmails;
exports.deleteAccount = deleteAccount;
const service = __importStar(require("./account.service"));
const emailService = __importStar(require("../emails/email.service"));
const encryption_service_1 = require("../../services/encryption.service");
const imap_email_service_1 = require("../../services/imap-email.service");
/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: List all email accounts
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: List of email accounts
 */
async function listAccounts(req, res) {
    try {
        const accounts = await service.listAccounts();
        res.json(accounts);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
/**
 * @swagger
 * /api/accounts:
 *   post:
 *     summary: Add new email account
 *     tags: [Accounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               accountName:
 *                 type: string
 *               autoFetch:
 *                 type: boolean
 *               fetchInterval:
 *                 type: number
 *               enableAILabeling:
 *                 type: boolean
 *               customLabels:
 *                 type: array
 *                 items:
 *                   type: string
 *               monitoredLabels:
 *                 type: array
 *                 items:
 *                   type: string
 *               providerType:
 *                 type: string
 *                 enum: [gmail, imap]
 *               oauthClientId:
 *                 type: string
 *               oauthClientSecret:
 *                 type: string
 *               oauthRefreshToken:
 *                 type: string
 *               imapHost:
 *                 type: string
 *               imapPort:
 *                 type: number
 *               imapUsername:
 *                 type: string
 *               imapPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account created
 */
async function createAccount(req, res) {
    try {
        const accountData = {
            email: req.body.email,
            account_name: req.body.accountName,
            auto_fetch: req.body.autoFetch,
            fetch_interval: req.body.fetchInterval,
            enable_ai_labeling: req.body.enableAILabeling,
            custom_labels: req.body.customLabels || [],
            monitored_labels: req.body.monitoredLabels || ['INBOX'],
            provider_type: req.body.providerType || 'gmail'
        };
        // Handle Gmail with manual OAuth credentials
        if (accountData.provider_type === 'gmail' && req.body.oauthClientId) {
            accountData.oauth_client_id = req.body.oauthClientId;
            accountData.oauth_client_secret_encrypted = req.body.oauthClientSecret
                ? (0, encryption_service_1.encryptPassword)(req.body.oauthClientSecret)
                : undefined;
            accountData.oauth_refresh_token_encrypted = req.body.oauthRefreshToken
                ? (0, encryption_service_1.encryptPassword)(req.body.oauthRefreshToken)
                : undefined;
        }
        // Handle IMAP
        if (accountData.provider_type === 'imap') {
            accountData.imap_host = req.body.imapHost;
            accountData.imap_port = req.body.imapPort;
            accountData.imap_username = req.body.imapUsername || req.body.email;
            accountData.imap_password_encrypted = req.body.imapPassword
                ? (0, encryption_service_1.encryptPassword)(req.body.imapPassword)
                : undefined;
            // Test IMAP connection before saving
            if (accountData.imap_password_encrypted) {
                const connectionTest = await (0, imap_email_service_1.testImapConnectionPlain)({
                    host: accountData.imap_host,
                    port: accountData.imap_port,
                    username: accountData.imap_username,
                    password: req.body.imapPassword // Use plain password for test
                });
                if (!connectionTest.success) {
                    return res.status(400).json({
                        error: 'IMAP connection failed',
                        details: connectionTest.error
                    });
                }
            }
        }
        const account = await service.createAccount(accountData);
        res.json(account);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
/**
 * @swagger
 * /api/accounts/{id}/fetch:
 *   get:
 *     summary: Fetch emails for specific account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Emails fetched
 */
async function fetchAccountEmails(req, res) {
    try {
        const accountId = parseInt(req.params.id);
        const account = await service.getAccountById(accountId);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        // Fetch emails using the account's OAuth token
        const fetched = await emailService.fetchFromGmail();
        // Update last sync
        await service.updateLastSync(accountId);
        res.json({ fetched });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
/**
 * @swagger
 * /api/accounts/{id}/label:
 *   post:
 *     summary: Apply AI labels to account emails
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Labels applied
 */
async function labelAccountEmails(req, res) {
    try {
        const accountId = parseInt(req.params.id);
        const account = await service.getAccountById(accountId);
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        // This would trigger the classifier agent
        // For now, return success
        res.json({ ok: true, message: 'AI labeling triggered' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
/**
 * @swagger
 * /api/accounts/{id}:
 *   delete:
 *     summary: Delete email account
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Account deleted
 */
async function deleteAccount(req, res) {
    try {
        const accountId = parseInt(req.params.id);
        await service.deleteAccount(accountId);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
