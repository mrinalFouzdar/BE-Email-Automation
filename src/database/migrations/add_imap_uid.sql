-- ============================================================================
-- Add imap_uid column to emails table
-- ============================================================================
-- This migration adds the imap_uid field to support IMAP-specific operations
-- like label assignment and email synchronization
-- ============================================================================

-- Add imap_uid column to emails table
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS imap_uid INTEGER;

-- Create index for faster lookups by IMAP UID
CREATE INDEX IF NOT EXISTS idx_emails_imap_uid ON emails(imap_uid);

-- Add comment for documentation
COMMENT ON COLUMN emails.imap_uid IS 'IMAP server-specific unique identifier for email operations';

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- The imap_uid field can now be used for:
-- 1. Label assignment operations via IMAP
-- 2. Email synchronization and updates
-- 3. Tracking emails across IMAP sessions
-- ============================================================================
