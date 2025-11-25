-- Add IMAP support to email_accounts table

ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS provider_type VARCHAR(20) DEFAULT 'gmail'
  CHECK (provider_type IN ('gmail', 'imap')),
ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255),
ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993,
ADD COLUMN IF NOT EXISTS imap_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS imap_password_encrypted TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider_type
  ON email_accounts(provider_type);

COMMENT ON COLUMN email_accounts.provider_type IS 'Email provider type: gmail (OAuth) or imap (password)';
COMMENT ON COLUMN email_accounts.imap_password_encrypted IS 'AES-256-CBC encrypted password';
