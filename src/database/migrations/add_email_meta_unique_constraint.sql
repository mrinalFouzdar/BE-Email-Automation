-- Add UNIQUE constraint on email_id in email_meta table
-- This is required for ON CONFLICT (email_id) clause in INSERT statements

-- First, remove any duplicate entries (keep the most recent one)
DELETE FROM email_meta a USING email_meta b
WHERE a.id < b.id AND a.email_id = b.email_id;

-- Add UNIQUE constraint
ALTER TABLE email_meta
ADD CONSTRAINT email_meta_email_id_unique UNIQUE (email_id);
