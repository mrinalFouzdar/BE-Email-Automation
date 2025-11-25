export interface EmailAccount {
  id: number;
  email: string;
  account_name: string;
  auto_fetch: boolean;
  fetch_interval: number;
  enable_ai_labeling: boolean;
  custom_labels: string[];
  monitored_labels: string[]; // Labels/folders to monitor
  status: 'pending' | 'connected' | 'error';
  provider_type: 'gmail' | 'imap';

  // Legacy OAuth (centralized credentials from env) - kept for backward compatibility
  oauth_token_id?: number;

  // Manual Gmail OAuth (user provides their own credentials)
  oauth_client_id?: string;
  oauth_client_secret_encrypted?: string;
  oauth_refresh_token_encrypted?: string;

  // IMAP credentials
  imap_host?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password_encrypted?: string;

  last_sync?: Date;
  created_at: Date;
  updated_at: Date;
}
