-- Labels table
CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE, -- true for Escalation, Urgent, MOM
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

-- Add label tracking to email_meta
ALTER TABLE email_meta 
ADD COLUMN IF NOT EXISTS suggested_label VARCHAR(100),
ADD COLUMN IF NOT EXISTS label_confidence FLOAT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_labels_name ON labels(name);
CREATE INDEX IF NOT EXISTS idx_user_labels_user_id ON user_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_email_labels_email_id ON email_labels(email_id);
