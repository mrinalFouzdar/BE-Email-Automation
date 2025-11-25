CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  gmail_id TEXT UNIQUE,
  thread_id TEXT,
  sender_email TEXT,
  to_recipients TEXT[],
  cc_recipients TEXT[],
  recipients TEXT[],
  subject TEXT,
  body TEXT,
  is_unread BOOLEAN DEFAULT TRUE,
  labels TEXT[],
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_meta (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  is_hierarchy BOOLEAN DEFAULT FALSE,
  is_client BOOLEAN DEFAULT FALSE,
  is_meeting BOOLEAN DEFAULT FALSE,
  is_escalation BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_mom BOOLEAN DEFAULT FALSE,
  has_mom_received BOOLEAN DEFAULT NULL,
  related_meeting_id INT REFERENCES emails(id) ON DELETE SET NULL,
  classification JSONB,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  reminder_text TEXT,
  reason TEXT,
  priority INT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_meta_embedding_idx
  ON email_meta
  USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 100);
