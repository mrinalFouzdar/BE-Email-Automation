-- Pending label suggestions table for admin/user approval workflow
-- When AI suggests a non-system label (not MOM/Escalation/Urgent),
-- it creates a pending suggestion that requires user/admin approval

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

  -- Prevent duplicate suggestions for same email
  UNIQUE(email_id, suggested_label_name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pending_labels_user_id ON pending_label_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_labels_status ON pending_label_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_pending_labels_email_id ON pending_label_suggestions(email_id);

-- Composite index for user's pending suggestions
CREATE INDEX IF NOT EXISTS idx_pending_labels_user_status ON pending_label_suggestions(user_id, status);

COMMENT ON TABLE pending_label_suggestions IS 'Stores AI-suggested labels that require user/admin approval before being applied';
COMMENT ON COLUMN pending_label_suggestions.user_id IS 'The user who owns the email account (not the approver)';
COMMENT ON COLUMN pending_label_suggestions.approved_by IS 'User or admin who approved/rejected the suggestion';
