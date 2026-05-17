-- 1. Wipe out any existing instances cleanly to avoid policy conflicts
DROP TABLE IF EXISTS call_logs CASCADE;
DROP TABLE IF EXISTS leads CASCADE;

-- 2. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create leads table with your exact new insurance/marketing schema
CREATE TABLE leads (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  leader_code  TEXT,
  nop          NUMERIC,
  prem         NUMERIC,
  utsaav       NUMERIC,
  ulip         NUMERIC,
  cat1         TEXT,
  cat2         NUMERIC,
  status       TEXT DEFAULT 'New',
  source       TEXT DEFAULT 'Manual',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create call_logs table
CREATE TABLE call_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id     BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lead_name   TEXT NOT NULL,
  company     TEXT,
  phone       TEXT,
  disposition TEXT DEFAULT 'Pending',
  notes       TEXT,
  called_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for leads
CREATE POLICY "Users can view their own leads" ON leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own leads" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own leads" ON leads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own leads" ON leads FOR DELETE USING (auth.uid() = user_id);

-- 7. Create RLS Policies for call_logs
CREATE POLICY "Users can view their own call logs" ON call_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own call logs" ON call_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own call logs" ON call_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own call logs" ON call_logs FOR DELETE USING (auth.uid() = user_id);

-- 8. Create indexes for performance
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX idx_call_logs_disposition ON call_logs(disposition);
CREATE INDEX idx_call_logs_called_at ON call_logs(called_at);
