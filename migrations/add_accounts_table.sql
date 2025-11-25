-- Table for managing multiple email accounts
CREATE TABLE IF NOT EXISTS email_accounts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  account_name VARCHAR(255) NOT NULL,
  auto_fetch BOOLEAN DEFAULT TRUE,
  fetch_interval INT DEFAULT 15, -- minutes
  enable_ai_labeling BOOLEAN DEFAULT TRUE,
  custom_labels TEXT[],
  status VARCHAR(50) DEFAULT 'pending', -- pending, connected, error
  oauth_token_id INT REFERENCES oauth_tokens(id) ON DELETE SET NULL,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update emails table to track which account they belong to
ALTER TABLE emails ADD COLUMN IF NOT EXISTS account_id INT REFERENCES email_accounts(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON email_accounts(status);
