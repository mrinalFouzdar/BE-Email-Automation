-- Create table for storing PDF attachments and their content
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_filename ON email_attachments(filename);

-- Create index for vector similarity search on PDF attachments
CREATE INDEX IF NOT EXISTS idx_email_attachments_embedding ON email_attachments
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create a combined view for searching both emails and PDF attachments
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

-- Add a comment to track migration
COMMENT ON TABLE email_attachments IS 'Stores PDF attachments from emails with vector embeddings for RAG search';
