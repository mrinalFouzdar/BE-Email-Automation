export type EmailProvider = 'gmail' | 'imap';

export interface EmailAccount {
  id: number;
  user_id: number;
  email: string;
  provider: EmailProvider;
  is_active: boolean;

  // OAuth fields (for Gmail)
  access_token?: string;
  refresh_token?: string;
  token_expiry?: Date;

  // IMAP fields
  imap_host?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password_encrypted?: string;
  imap_tls?: boolean;

  // Sync fields
  auto_fetch: boolean;
  fetch_interval: number;
  enable_ai_labeling: boolean;
  monitored_labels: string[];
  status: string;

  last_sync_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface AccountCreateInput {
  user_id: number;
  email: string;
  provider: EmailProvider;

  // OAuth
  access_token?: string;
  refresh_token?: string;
  token_expiry?: Date;

  // IMAP
  imap_host?: string;
  imap_port?: number;
  imap_username?: string;
  imap_password_encrypted?: string;
  imap_tls?: boolean;

  // Sync settings
  auto_fetch?: boolean;
  fetch_interval?: number;
  enable_ai_labeling?: boolean;
  monitored_labels?: string[];
  status?: string;
}

export interface IMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}
