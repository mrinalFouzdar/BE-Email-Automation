-- Add is_approved column to labels table
-- This tracks whether a label has been approved for IMAP sync

ALTER TABLE labels 
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- System labels (MOM, Escalation, Urgent) are pre-approved
UPDATE labels 
SET is_approved = TRUE 
WHERE name IN ('MOM', 'Escalation', 'Urgent');

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_labels_is_approved ON labels(is_approved);
