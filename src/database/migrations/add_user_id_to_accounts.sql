-- Add user_id to email_accounts to link accounts to users
-- This enables multi-user support where each user can have multiple email accounts

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;

-- Create index for faster user account lookups
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);

-- Make user_id NOT NULL for new entries (existing entries can be NULL for now)
-- This allows backward compatibility with existing accounts
COMMENT ON COLUMN email_accounts.user_id IS 'The user who owns this email account';
