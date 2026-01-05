-- ============================================================================
-- EMAIL RAG - Initial Database Setup
-- ============================================================================
-- This migration sets up the complete database schema for the Email RAG system
-- Run this ONCE when setting up a new database
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user', -- 'user' or 'admin'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================================
-- 2. EMAIL ACCOUNTS TABLE (Gmail, IMAP, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  provider VARCHAR(50) NOT NULL, -- 'gmail', 'imap'
  is_active BOOLEAN DEFAULT TRUE,

  -- IMAP specific fields
  imap_host VARCHAR(255),
  imap_port INT,
  imap_username VARCHAR(255),
  imap_password_encrypted TEXT, -- Renamed from imap_encrypted_password to match code

  -- Codebase requires these fields:
  auto_fetch BOOLEAN DEFAULT TRUE,
  fetch_interval INT DEFAULT 15, -- minutes
  enable_ai_labeling BOOLEAN DEFAULT TRUE,
  monitored_labels TEXT[], -- PostgreSQL array
  status VARCHAR(50) DEFAULT 'connected', -- 'connected', 'error', 'disconnected'

  -- OAuth fields (for Gmail)
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,

  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email);

-- ============================================================================
-- 3. EMAILS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  account_id INT REFERENCES email_accounts(id) ON DELETE CASCADE,

  -- Email identifiers
  message_id VARCHAR(255) UNIQUE,
  gmail_id TEXT,
  thread_id TEXT,
  imap_uid INT, -- Unique ID from IMAP server
  imap_mailbox VARCHAR(255),

  -- Email content
  subject TEXT,
  body TEXT,
  body_plain TEXT,

  -- Email metadata
  sender VARCHAR(255),
  sender_email TEXT,
  sender_name TEXT,
  to_recipients TEXT[],
  cc_recipients TEXT[],
  recipients TEXT[],
  recipient TEXT,

  -- Status flags
  is_unread BOOLEAN DEFAULT TRUE,
  is_read BOOLEAN DEFAULT FALSE,
  is_starred BOOLEAN DEFAULT FALSE,
  is_important BOOLEAN DEFAULT FALSE,
  has_attachments BOOLEAN DEFAULT FALSE,

  -- Labels
  labels TEXT[],
  gmail_labels TEXT[],

  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  received_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);
CREATE INDEX IF NOT EXISTS idx_emails_received_date ON emails(received_date);
CREATE INDEX IF NOT EXISTS idx_emails_is_unread ON emails(is_unread);

-- ============================================================================
-- 4. EMAIL METADATA & AI CLASSIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_meta (
  id SERIAL PRIMARY KEY,
  email_id INT UNIQUE REFERENCES emails(id) ON DELETE CASCADE,

  -- AI Classifications
  is_hierarchy BOOLEAN DEFAULT FALSE,
  is_client BOOLEAN DEFAULT FALSE,
  is_meeting BOOLEAN DEFAULT FALSE,
  is_escalation BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_mom BOOLEAN DEFAULT FALSE,
  has_mom_received BOOLEAN DEFAULT NULL,

  -- Related data
  related_meeting_id INT REFERENCES emails(id) ON DELETE SET NULL,
  classification JSONB,
  suggested_label VARCHAR(255),
  label_confidence FLOAT DEFAULT 0.0,

  -- Vector embeddings (768 dimensions for Gemini/Ollama)
  embedding vector(768),
  embedding_model VARCHAR(50), -- 'gemini', 'ollama'
  vector_embedding vector(768),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_meta_email_id ON email_meta(email_id);
CREATE INDEX IF NOT EXISTS idx_email_meta_embedding_model ON email_meta(embedding_model);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS email_meta_embedding_idx
  ON email_meta
  USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_email_meta_vector
  ON email_meta
  USING ivfflat (vector_embedding vector_cosine_ops);

-- ============================================================================
-- 5. LABELS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  created_by_user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7), -- Hex color code
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(created_by_user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_labels_user_id ON labels(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_labels_name ON labels(name);

-- ============================================================================
-- 5a. USER LABELS (Many-to-Many for System Labels assignment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_labels (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  label_id INT REFERENCES labels(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, label_id)
);

-- ============================================================================
-- 6. EMAIL LABELS (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_labels (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  label_id INT REFERENCES labels(id) ON DELETE CASCADE,
  similarity_score FLOAT,
  confidence_score FLOAT, -- Added for compatibility
  assignment_method VARCHAR(50), -- 'manual', 'ai_auto', 'ai_approved', 'similarity', 'hybrid'
  assigned_by VARCHAR(50), -- 'ai', 'user', 'admin', 'system'
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(email_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_email_labels_email_id ON email_labels(email_id);
CREATE INDEX IF NOT EXISTS idx_email_labels_label_id ON email_labels(label_id);

-- ============================================================================
-- 7. LABEL EMBEDDINGS (Centroids)
-- ============================================================================
CREATE TABLE IF NOT EXISTS label_embeddings (
  label_id INTEGER PRIMARY KEY REFERENCES labels(id) ON DELETE CASCADE,
  embedding vector(768),
  embedding_model VARCHAR(50), -- 'gemini', 'ollama'
  email_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. PENDING LABEL SUGGESTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS pending_label_suggestions (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  label_id INT REFERENCES labels(id) ON DELETE CASCADE, -- Optional, if suggesting an existing label
  suggested_label_name VARCHAR(255), -- If suggesting a NEW label name
  suggested_by VARCHAR(50) DEFAULT 'ai', -- 'ai', 'system'
  confidence_score FLOAT, 
  reasoning TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  approved_by INT REFERENCES users(id), -- User who approved/rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(email_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_suggestions_email_id ON pending_label_suggestions(email_id);
CREATE INDEX IF NOT EXISTS idx_pending_suggestions_status ON pending_label_suggestions(status);

-- ============================================================================
-- 9. REMINDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  reminder_text TEXT,
  message TEXT,
  reason TEXT,
  priority INT,
  resolved BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  reminder_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_email_id ON reminders(email_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_reminder_date ON reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);

-- ============================================================================
-- 10. OAUTH TOKENS TABLE (Legacy - for Gmail OAuth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expiry TIMESTAMP WITH TIME ZONE,
  expiry_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_email ON oauth_tokens(email);

-- ============================================================================
-- 11. CLASSIFICATIONS TABLE (AI Processing Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS classifications (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  classifier_type VARCHAR(100),
  classification_result JSONB,
  confidence_score FLOAT,
  processing_time_ms INT,
  model_used VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classifications_email_id ON classifications(email_id);
CREATE INDEX IF NOT EXISTS idx_classifications_classifier_type ON classifications(classifier_type);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE email_accounts IS 'Stores user email accounts (Gmail, IMAP)';
COMMENT ON TABLE emails IS 'Main emails table with content and metadata';
COMMENT ON TABLE email_meta IS 'AI classifications and vector embeddings for emails';
COMMENT ON COLUMN email_meta.embedding IS 'Vector embedding (768D) for semantic search';
COMMENT ON COLUMN email_meta.embedding_model IS 'Model used: gemini or ollama. Only compare embeddings from same model!';
COMMENT ON TABLE labels IS 'User-defined labels/categories for organizing emails';
COMMENT ON TABLE email_labels IS 'Many-to-many relationship between emails and labels';
COMMENT ON TABLE label_embeddings IS 'Centroid embeddings for each label';
COMMENT ON TABLE pending_label_suggestions IS 'AI-suggested labels awaiting user approval';

-- ============================================================================
-- 293 (Cont). EMAIL ATTACHMENTS (for PDF RAG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_attachments (
  id SERIAL PRIMARY KEY,
  email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  content_type VARCHAR(200) DEFAULT 'application/pdf',
  file_size INTEGER,
  content TEXT, -- Extracted text content from PDF
  raw_data BYTEA, -- Optional: store the actual file data
  embedding vector(768), -- Vector embedding for the PDF content
  embedding_model VARCHAR(50), -- Track which model generated the embedding
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_filename ON email_attachments(filename);

-- Create index for vector similarity search on PDF attachments
CREATE INDEX IF NOT EXISTS idx_email_attachments_embedding ON email_attachments
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMENT ON TABLE email_attachments IS 'Stores PDF attachments from emails with vector embeddings for RAG search';

-- ============================================================================
-- 294. TOKEN USAGE SATS
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_usage_stats (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  classification_method VARCHAR(20) NOT NULL, -- 'cache', 'domain', 'regex', 'llm'
  estimated_tokens INT DEFAULT 0,
  tokens_saved INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email_id)
);

CREATE INDEX IF NOT EXISTS idx_token_stats_method ON token_usage_stats(classification_method);
CREATE INDEX IF NOT EXISTS idx_token_stats_created ON token_usage_stats(created_at);

COMMENT ON TABLE token_usage_stats IS 'Tracks LLM token usage and optimization savings';

-- ============================================================================
-- 295. SEARCHABLE CONTENT VIEW (Emails + PDFs)
-- ============================================================================
CREATE OR REPLACE VIEW searchable_content AS
SELECT
  e.id as email_id,
  e.subject,
  e.body as content,
  em.embedding,
  em.embedding_model,
  'email' as content_type,
  e.sender_email as source,
  e.received_at as date,
  NULL as filename
FROM emails e
LEFT JOIN email_meta em ON e.id = em.email_id
WHERE em.embedding IS NOT NULL

UNION ALL

SELECT
  ea.email_id,
  e.subject,
  ea.content,
  ea.embedding,
  ea.embedding_model,
  'pdf_attachment' as content_type,
  e.sender_email as source,
  e.received_at as date,
  ea.filename
FROM email_attachments ea
JOIN emails e ON ea.email_id = e.id
WHERE ea.embedding IS NOT NULL;


-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Database schema created successfully!
-- Next steps:
-- 1. Create admin user: INSERT INTO users (email, password_hash, name, role) VALUES (...)
-- 2. Add email account: INSERT INTO email_accounts (user_id, email, account_type, ...) VALUES (...)
-- 3. Start email sync
-- ============================================================================
