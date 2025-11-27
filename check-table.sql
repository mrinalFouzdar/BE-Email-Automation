-- Check if pending_label_suggestions table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'pending_label_suggestions'
) as table_exists;

-- If it exists, show its structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_label_suggestions'
ORDER BY ordinal_position;
