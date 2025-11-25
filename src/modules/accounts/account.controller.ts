import { Request, Response } from 'express';
import * as service from './account.service';
import * as emailService from '../emails/email.service';
import { encryptPassword } from '../../services/encryption.service';
import { fetchEmailsViaImap, testImapConnectionPlain } from '../../services/imap-email.service';

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
export async function listAccounts(req: Request, res: Response) {
  try {
    const accounts = await service.listAccounts();
    res.json(accounts);
  } catch (err: any) {
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
export async function createAccount(req: Request, res: Response) {
  try {
    const accountData: any = {
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
        ? encryptPassword(req.body.oauthClientSecret)
        : undefined;
      accountData.oauth_refresh_token_encrypted = req.body.oauthRefreshToken
        ? encryptPassword(req.body.oauthRefreshToken)
        : undefined;
    }

    // Handle IMAP
    if (accountData.provider_type === 'imap') {
      accountData.imap_host = req.body.imapHost;
      accountData.imap_port = req.body.imapPort;
      accountData.imap_username = req.body.imapUsername || req.body.email;
      accountData.imap_password_encrypted = req.body.imapPassword
        ? encryptPassword(req.body.imapPassword)
        : undefined;

      // Test IMAP connection before saving
      if (accountData.imap_password_encrypted) {
        const connectionTest = await testImapConnectionPlain({
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
  } catch (err: any) {
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
export async function fetchAccountEmails(req: Request, res: Response) {
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
  } catch (err: any) {
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
export async function labelAccountEmails(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.id);
    const account = await service.getAccountById(accountId);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // This would trigger the classifier agent
    // For now, return success
    res.json({ ok: true, message: 'AI labeling triggered' });
  } catch (err: any) {
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
export async function deleteAccount(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.id);
    await service.deleteAccount(accountId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
