-- Fix all missing columns identified in database validation

-- ============================================================================
-- 1. email_accounts - Add is_active
-- ============================================================================
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================================================
-- 2. emails - Add missing columns
-- ============================================================================
ALTER TABLE emails ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS sender VARCHAR(255);
ALTER TABLE emails ADD COLUMN IF NOT EXISTS recipient TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS body_plain TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS received_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT FALSE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS gmail_labels TEXT[];

-- Create index on message_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
CREATE INDEX IF NOT EXISTS idx_emails_received_date ON emails(received_date);

-- ============================================================================
-- 3. email_meta - Add missing columns
-- ============================================================================
ALTER TABLE email_meta ADD COLUMN IF NOT EXISTS vector_embedding vector(1536);
ALTER TABLE email_meta ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on vector_embedding for similarity search
CREATE INDEX IF NOT EXISTS idx_email_meta_vector ON email_meta USING ivfflat (vector_embedding vector_cosine_ops);

-- ============================================================================
-- 4. labels - Add missing columns
-- ============================================================================
ALTER TABLE labels ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE labels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(user_id);

-- ============================================================================
-- 5. email_labels - Add missing columns
-- ============================================================================
ALTER TABLE email_labels ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================================
-- 6. reminders - Add missing columns
-- ============================================================================
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_reminder_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);

-- ============================================================================
-- 7. oauth_tokens - Add missing columns
-- ============================================================================
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);

COMMENT ON COLUMN email_accounts.is_active IS 'Whether this email account is active';
COMMENT ON COLUMN emails.message_id IS 'Unique message identifier from email provider';
COMMENT ON COLUMN emails.sender IS 'Email sender address';
COMMENT ON COLUMN emails.recipient IS 'Email recipient addresses';
COMMENT ON COLUMN emails.body_plain IS 'Plain text version of email body';
COMMENT ON COLUMN emails.received_date IS 'Date when email was received';
COMMENT ON COLUMN labels.user_id IS 'User who owns this label';
COMMENT ON COLUMN reminders.user_id IS 'User who created this reminder';
COMMENT ON COLUMN oauth_tokens.user_id IS 'User who owns this OAuth token';
