-- Add embeddings support for better label suggestions

-- 1. Add embedding column to email_labels for tracking assignment confidence
ALTER TABLE email_labels ADD COLUMN IF NOT EXISTS similarity_score FLOAT;
ALTER TABLE email_labels ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(20) DEFAULT 'manual';
  -- Values: 'manual', 'ai_auto', 'ai_approved', 'similarity'

COMMENT ON COLUMN email_labels.similarity_score IS 'Cosine similarity score when assigned via embedding similarity (0-1)';
COMMENT ON COLUMN email_labels.assignment_method IS 'How this label was assigned: manual, ai_auto, ai_approved, similarity';

-- 2. Create label_embeddings table to store aggregated embeddings for each label
CREATE TABLE IF NOT EXISTS label_embeddings (
  id SERIAL PRIMARY KEY,
  label_id INT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  email_count INT DEFAULT 0,  -- Number of emails contributing to this embedding
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(label_id)
);

-- Index for similarity search on label embeddings
CREATE INDEX IF NOT EXISTS idx_label_embeddings_vector
  ON label_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_label_embeddings_label_id ON label_embeddings(label_id);

COMMENT ON TABLE label_embeddings IS 'Stores aggregated vector embeddings for each label, used for similarity-based label suggestions';
COMMENT ON COLUMN label_embeddings.embedding IS 'Average embedding vector computed from all emails with this label';
COMMENT ON COLUMN label_embeddings.email_count IS 'Number of emails used to compute this embedding (for weighted averaging)';

-- 3. Add metadata to pending_label_suggestions for tracking similarity
ALTER TABLE pending_label_suggestions ADD COLUMN IF NOT EXISTS similarity_score FLOAT;
ALTER TABLE pending_label_suggestions ADD COLUMN IF NOT EXISTS similar_email_ids INT[];
ALTER TABLE pending_label_suggestions ADD COLUMN IF NOT EXISTS suggestion_method VARCHAR(20) DEFAULT 'ai';
  -- Values: 'ai' (LLM-based), 'similarity' (embedding-based), 'hybrid' (both)
ALTER TABLE pending_label_suggestions ADD COLUMN IF NOT EXISTS key_phrases TEXT[];
ALTER TABLE pending_label_suggestions ADD COLUMN IF NOT EXISTS explanation TEXT;

COMMENT ON COLUMN pending_label_suggestions.similarity_score IS 'Embedding similarity score for similarity-based suggestions';
COMMENT ON COLUMN pending_label_suggestions.similar_email_ids IS 'IDs of similar emails that have this label';
COMMENT ON COLUMN pending_label_suggestions.suggestion_method IS 'Method used to suggest this label: ai, similarity, or hybrid';
COMMENT ON COLUMN pending_label_suggestions.key_phrases IS 'Key words/phrases that triggered this classification (e.g., ["meeting minutes", "action items"])';
COMMENT ON COLUMN pending_label_suggestions.explanation IS 'Human-readable explanation of why AI suggested this label';
