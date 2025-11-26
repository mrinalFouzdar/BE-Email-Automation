-- Check all email accounts
SELECT
  id,
  email,
  provider_type,
  status,
  auto_fetch,
  enable_ai_labeling,
  last_sync,
  created_at
FROM email_accounts;

-- Count emails by account type
SELECT
  ea.provider_type,
  COUNT(e.id) as email_count
FROM email_accounts ea
LEFT JOIN emails e ON e.account_id = ea.id
GROUP BY ea.provider_type;

-- Total counts
SELECT
  (SELECT COUNT(*) FROM email_accounts) as total_accounts,
  (SELECT COUNT(*) FROM email_accounts WHERE provider_type = 'imap') as imap_accounts,
  (SELECT COUNT(*) FROM email_accounts WHERE provider_type = 'gmail') as gmail_accounts,
  (SELECT COUNT(*) FROM emails) as total_emails,
  (SELECT COUNT(*) FROM email_meta) as total_classifications;
