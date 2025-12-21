-- Token Usage Statistics Table
-- Tracks token consumption and savings for cost optimization

CREATE TABLE IF NOT EXISTS token_usage_stats (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,

  -- Classification method used
  classification_method VARCHAR(20) NOT NULL, -- 'cache', 'domain', 'regex', 'llm'

  -- Token metrics
  estimated_tokens INT DEFAULT 0,
  tokens_saved INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one entry per email
  UNIQUE(email_id)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_token_stats_method ON token_usage_stats(classification_method);
CREATE INDEX IF NOT EXISTS idx_token_stats_created ON token_usage_stats(created_at);

-- Comments
COMMENT ON TABLE token_usage_stats IS 'Tracks LLM token usage and optimization savings';
COMMENT ON COLUMN token_usage_stats.classification_method IS 'Method used: cache (0 tokens), domain (0 tokens), regex (0 tokens), llm (costs tokens)';
COMMENT ON COLUMN token_usage_stats.estimated_tokens IS 'Estimated tokens used for LLM classification';
COMMENT ON COLUMN token_usage_stats.tokens_saved IS 'Tokens saved through optimization (truncation, caching, etc.)';
