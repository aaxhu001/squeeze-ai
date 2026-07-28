-- migration: 001_squeeze_tables.sql

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS squeeze_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  summary_json JSONB NOT NULL,
  edited_summary_json JSONB,               -- user override, if they edit before continuing
  covers_up_to_message_id UUID,
  source_token_count INT,
  output_token_count INT,
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  status TEXT DEFAULT 'ready',              -- pending, ready, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squeeze_session ON squeeze_summaries(session_id, version DESC);

CREATE TABLE IF NOT EXISTS squeeze_sessions_link (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_session_id UUID NOT NULL REFERENCES sessions(id),
  child_session_id UUID NOT NULL REFERENCES sessions(id),
  summary_id UUID NOT NULL REFERENCES squeeze_summaries(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS squeeze_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month DATE NOT NULL,                      -- first-of-month, for easy grouping
  squeeze_count INT DEFAULT 0,
  total_tokens_processed INT DEFAULT 0,
  UNIQUE(user_id, month)
);
