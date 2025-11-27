-- Create classifications table for storing email classification results

CREATE TABLE IF NOT EXISTS classifications (
  id SERIAL PRIMARY KEY,
  email_id INT NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  is_escalation BOOLEAN DEFAULT FALSE,
  is_mom BOOLEAN DEFAULT FALSE,  -- Minutes of Meeting
  is_urgent BOOLEAN DEFAULT FALSE,
  confidence_score FLOAT,  -- Overall confidence (0-1)
  classified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one classification per email
  UNIQUE(email_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_classifications_email_id ON classifications(email_id);
CREATE INDEX IF NOT EXISTS idx_classifications_is_escalation ON classifications(is_escalation);
CREATE INDEX IF NOT EXISTS idx_classifications_is_mom ON classifications(is_mom);
CREATE INDEX IF NOT EXISTS idx_classifications_is_urgent ON classifications(is_urgent);
CREATE INDEX IF NOT EXISTS idx_classifications_classified_at ON classifications(classified_at);

-- Composite index for filtering by multiple classification types
CREATE INDEX IF NOT EXISTS idx_classifications_types ON classifications(is_escalation, is_mom, is_urgent);

COMMENT ON TABLE classifications IS 'Stores AI classification results for emails (escalation, MOM, urgent)';
COMMENT ON COLUMN classifications.is_escalation IS 'Whether email requires escalation';
COMMENT ON COLUMN classifications.is_mom IS 'Whether email contains minutes of meeting';
COMMENT ON COLUMN classifications.is_urgent IS 'Whether email is urgent and requires immediate attention';
COMMENT ON COLUMN classifications.confidence_score IS 'AI confidence score for classification (0-1)';
