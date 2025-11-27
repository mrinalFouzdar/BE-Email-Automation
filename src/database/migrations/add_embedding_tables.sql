-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to email_meta
ALTER TABLE email_meta 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Create label_embeddings table
CREATE TABLE IF NOT EXISTS label_embeddings (
    label_id INTEGER REFERENCES labels(id) ON DELETE CASCADE,
    embedding vector(768),
    email_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (label_id)
);

-- Add new columns to email_labels
ALTER TABLE email_labels
ADD COLUMN IF NOT EXISTS similarity_score FLOAT,
ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(50); -- 'manual', 'ai_auto', 'ai_approved', 'similarity', 'hybrid'

-- Add new columns to pending_label_suggestions
ALTER TABLE pending_label_suggestions
ADD COLUMN IF NOT EXISTS similarity_score FLOAT,
ADD COLUMN IF NOT EXISTS similar_email_ids INTEGER[],
ADD COLUMN IF NOT EXISTS suggestion_method VARCHAR(50); -- 'ai', 'similarity', 'hybrid'
