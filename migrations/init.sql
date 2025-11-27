-- ====================================
-- EMAIL RAG DATABASE INITIALIZATION
-- ====================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ====================================
-- BASE TABLES
-- ====================================

-- Emails table
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

-- Email metadata with AI classifications
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
  suggested_label VARCHAR(100),
  label_confidence FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Reminders extracted from emails
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  reminder_text TEXT,
  reason TEXT,
  priority INT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- OAuth tokens for Gmail authentication
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expiry TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ====================================
-- USER MANAGEMENT
-- ====================================

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ====================================
-- EMAIL ACCOUNTS MANAGEMENT
-- ====================================

-- Email accounts table for multi-account support
CREATE TABLE IF NOT EXISTS email_accounts (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  account_name VARCHAR(255) NOT NULL,
  auto_fetch BOOLEAN DEFAULT TRUE,
  fetch_interval INT DEFAULT 15, -- minutes
  enable_ai_labeling BOOLEAN DEFAULT TRUE,
  custom_labels TEXT[],
  status VARCHAR(50) DEFAULT 'pending', -- pending, connected, error
  oauth_token_id INT REFERENCES oauth_tokens(id) ON DELETE SET NULL,
  last_sync TIMESTAMP WITH TIME ZONE,
  provider_type VARCHAR(20) DEFAULT 'gmail' CHECK (provider_type IN ('gmail', 'imap')),
  imap_host VARCHAR(255),
  imap_port INTEGER DEFAULT 993,
  imap_username VARCHAR(255),
  imap_password_encrypted TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link emails to accounts
ALTER TABLE emails ADD COLUMN IF NOT EXISTS account_id INT REFERENCES email_accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_emails_account_id ON emails(account_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_status ON email_accounts(status);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider_type ON email_accounts(provider_type);

COMMENT ON COLUMN email_accounts.provider_type IS 'Email provider type: gmail (OAuth) or imap (password)';
COMMENT ON COLUMN email_accounts.imap_password_encrypted IS 'AES-256-CBC encrypted password';

-- ====================================
-- LABELS SYSTEM
-- ====================================

-- Labels table for email categorization
CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE, -- true for Escalation, Urgent, MOM
  is_approved BOOLEAN DEFAULT FALSE, -- tracks whether label is approved for IMAP sync
  created_by_user_id INT REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-Label mapping
CREATE TABLE IF NOT EXISTS user_labels (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  label_id INT REFERENCES labels(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, label_id)
);

-- Email-Label mapping
CREATE TABLE IF NOT EXISTS email_labels (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  label_id INT REFERENCES labels(id) ON DELETE CASCADE,
  assigned_by VARCHAR(20) DEFAULT 'ai', -- 'ai', 'user', 'admin', 'system'
  confidence_score FLOAT, -- AI confidence (0-1)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email_id, label_id)
);

-- Pending label suggestions for approval workflow
CREATE TABLE IF NOT EXISTS pending_label_suggestions (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,  -- Owner of the email account
  suggested_label_name VARCHAR(100) NOT NULL,
  suggested_by VARCHAR(20) DEFAULT 'ai',  -- 'ai' or 'system'
  confidence_score FLOAT,  -- AI confidence (0-1)
  reasoning TEXT,  -- Why AI suggested this label
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,  -- User or admin who approved/rejected
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email_id, suggested_label_name)
);

-- ====================================
-- INDEXES
-- ====================================

-- Email embeddings index for vector similarity search
CREATE INDEX IF NOT EXISTS email_meta_embedding_idx
  ON email_meta
  USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 100);

-- Labels indexes
CREATE INDEX IF NOT EXISTS idx_labels_name ON labels(name);
CREATE INDEX IF NOT EXISTS idx_labels_is_approved ON labels(is_approved);
CREATE INDEX IF NOT EXISTS idx_user_labels_user_id ON user_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_email_labels_email_id ON email_labels(email_id);

-- Pending labels indexes
CREATE INDEX IF NOT EXISTS idx_pending_labels_user_id ON pending_label_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_labels_status ON pending_label_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_pending_labels_email_id ON pending_label_suggestions(email_id);
CREATE INDEX IF NOT EXISTS idx_pending_labels_user_status ON pending_label_suggestions(user_id, status);

-- ====================================
-- INITIAL DATA
-- ====================================

-- System labels (pre-approved)
INSERT INTO labels (name, color, is_system, is_approved, description)
VALUES
  ('MOM', '#10B981', TRUE, TRUE, 'Minutes of Meeting'),
  ('Escalation', '#EF4444', TRUE, TRUE, 'Escalated issues requiring attention'),
  ('Urgent', '#F59E0B', TRUE, TRUE, 'Urgent emails requiring immediate action')
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE pending_label_suggestions IS 'Stores AI-suggested labels that require user/admin approval before being applied';
COMMENT ON COLUMN pending_label_suggestions.user_id IS 'The user who owns the email account (not the approver)';
COMMENT ON COLUMN pending_label_suggestions.approved_by IS 'User or admin who approved/rejected the suggestion';
