-- Add support for user-provided OAuth credentials and monitored labels

-- Add OAuth credentials columns for Gmail (user provides their own OAuth app)
ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS oauth_client_id TEXT,
ADD COLUMN IF NOT EXISTS oauth_client_secret_encrypted TEXT,
ADD COLUMN IF NOT EXISTS oauth_refresh_token_encrypted TEXT;

-- Add monitored labels/folders
ALTER TABLE email_accounts
ADD COLUMN IF NOT EXISTS monitored_labels TEXT[] DEFAULT ARRAY['INBOX']::TEXT[];

-- Comments for documentation
COMMENT ON COLUMN email_accounts.oauth_client_id IS 'User-provided OAuth Client ID for Gmail API';
COMMENT ON COLUMN email_accounts.oauth_client_secret_encrypted IS 'AES-256-CBC encrypted OAuth Client Secret';
COMMENT ON COLUMN email_accounts.oauth_refresh_token_encrypted IS 'AES-256-CBC encrypted OAuth Refresh Token';
COMMENT ON COLUMN email_accounts.monitored_labels IS 'Labels/folders to monitor (e.g., INBOX, Orders, etc.)';
