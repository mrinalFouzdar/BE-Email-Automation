-- Add new fields to emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS to_recipients TEXT[];
ALTER TABLE emails ADD COLUMN IF NOT EXISTS cc_recipients TEXT[];
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_unread BOOLEAN DEFAULT TRUE;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS labels TEXT[];

-- Add MoM tracking fields to email_meta table
ALTER TABLE email_meta ADD COLUMN IF NOT EXISTS is_mom BOOLEAN DEFAULT FALSE;
ALTER TABLE email_meta ADD COLUMN IF NOT EXISTS has_mom_received BOOLEAN DEFAULT NULL;
ALTER TABLE email_meta ADD COLUMN IF NOT EXISTS related_meeting_id INT REFERENCES emails(id) ON DELETE SET NULL;
