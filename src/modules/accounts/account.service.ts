import { client } from '../../config/db';
import { EmailAccount } from './account.model';
import { encryptPassword } from '../../services/encryption.service';
import { detectImapConfig } from '../../utils/imap-config';

export async function listAccounts(): Promise<EmailAccount[]> {
  const result = await client.query(
    'SELECT * FROM email_accounts ORDER BY created_at DESC'
  );
  return result.rows;
}

export async function getAccountById(id: number): Promise<EmailAccount | null> {
  const result = await client.query(
    'SELECT * FROM email_accounts WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

export async function createAccount(account: Partial<EmailAccount>): Promise<EmailAccount> {
  const providerType = account.provider_type || 'gmail';

  if (providerType === 'imap') {
    // Auto-detect IMAP settings if not provided
    let imapHost = account.imap_host;
    let imapPort = account.imap_port || 993;

    if (!imapHost && account.email) {
      const config = detectImapConfig(account.email);
      if (config) {
        imapHost = config.host;
        imapPort = config.port;
      }
    }

    if (!imapHost) {
      throw new Error('IMAP host is required or email domain is not supported');
    }

    // Create IMAP account
    const result = await client.query(
      `INSERT INTO email_accounts (
        email, account_name, auto_fetch, fetch_interval, enable_ai_labeling,
        custom_labels, monitored_labels, provider_type, imap_host, imap_port,
        imap_username, imap_password_encrypted, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        account.email,
        account.account_name,
        account.auto_fetch ?? true,
        account.fetch_interval ?? 15,
        account.enable_ai_labeling ?? true,
        account.custom_labels ?? [],
        account.monitored_labels ?? ['INBOX'],
        'imap',
        imapHost,
        imapPort,
        account.imap_username || account.email,
        account.imap_password_encrypted,
        'connected' // IMAP accounts are immediately connected
      ]
    );
    return result.rows[0];
  } else if (providerType === 'gmail' && account.oauth_client_id) {
    // Create Gmail OAuth account with manual credentials
    const result = await client.query(
      `INSERT INTO email_accounts (
        email, account_name, auto_fetch, fetch_interval, enable_ai_labeling,
        custom_labels, monitored_labels, provider_type, oauth_client_id,
        oauth_client_secret_encrypted, oauth_refresh_token_encrypted, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        account.email,
        account.account_name,
        account.auto_fetch ?? true,
        account.fetch_interval ?? 15,
        account.enable_ai_labeling ?? true,
        account.custom_labels ?? [],
        account.monitored_labels ?? ['INBOX'],
        'gmail',
        account.oauth_client_id,
        account.oauth_client_secret_encrypted,
        account.oauth_refresh_token_encrypted,
        'connected' // Manual OAuth accounts are immediately connected if refresh token is provided
      ]
    );
    return result.rows[0];
  } else {
    // Create Gmail OAuth account (legacy popup flow)
    const result = await client.query(
      `INSERT INTO email_accounts (
        email, account_name, auto_fetch, fetch_interval, enable_ai_labeling,
        custom_labels, monitored_labels, provider_type, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        account.email,
        account.account_name,
        account.auto_fetch ?? true,
        account.fetch_interval ?? 15,
        account.enable_ai_labeling ?? true,
        account.custom_labels ?? [],
        account.monitored_labels ?? ['INBOX'],
        'gmail',
        'pending' // Gmail requires OAuth
      ]
    );
    return result.rows[0];
  }
}

export async function updateAccountStatus(id: number, status: string, oauth_token_id?: number): Promise<void> {
  await client.query(
    'UPDATE email_accounts SET status = $1, oauth_token_id = $2, updated_at = NOW() WHERE id = $3',
    [status, oauth_token_id, id]
  );
}

export async function updateLastSync(id: number): Promise<void> {
  await client.query(
    'UPDATE email_accounts SET last_sync = NOW(), updated_at = NOW() WHERE id = $1',
    [id]
  );
}

export async function deleteAccount(id: number): Promise<void> {
  await client.query('DELETE FROM email_accounts WHERE id = $1', [id]);
}
