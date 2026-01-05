-- Add imap_mailbox column to emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS imap_mailbox VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_emails_imap_mailbox ON emails(imap_mailbox);

-- Add comment
COMMENT ON COLUMN emails.imap_mailbox IS 'IMAP mailbox where the UID is valid (e.g., INBOX, [Gmail]/All Mail). CRITICAL: UID is only valid within this mailbox!';

-- Verify the column was added
SELECT 'imap_mailbox column added successfully!' as status;
