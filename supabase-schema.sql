-- 2. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create leads table with your exact new insurance/marketing schema
CREATE TABLE IF NOT EXISTS leads (
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
  status       TEXT DEFAULT 'Not Picked',
  source       TEXT DEFAULT 'Manual',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create call_logs table
CREATE TABLE IF NOT EXISTS call_logs (
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
DROP POLICY IF EXISTS "Users can view their own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;
CREATE POLICY "Users can view their own leads" ON leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own leads" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own leads" ON leads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own leads" ON leads FOR DELETE USING (auth.uid() = user_id);

-- 7. Create RLS Policies for call_logs
DROP POLICY IF EXISTS "Users can view their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can insert their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can update their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can delete their own call logs" ON call_logs;
CREATE POLICY "Users can view their own call logs" ON call_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own call logs" ON call_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own call logs" ON call_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own call logs" ON call_logs FOR DELETE USING (auth.uid() = user_id);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_user_id ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON call_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_disposition ON call_logs(disposition);
CREATE INDEX IF NOT EXISTS idx_call_logs_called_at ON call_logs(called_at);

-- Role and assignment support. Existing accounts become managers.
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('manager', 'submanager')) DEFAULT 'manager',
  manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS submanager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS submanager_name TEXT;
UPDATE leads SET manager_id = user_id WHERE manager_id IS NULL;
COMMENT ON COLUMN leads.submanager_name IS 'Submanager assignment imported from the master Excel subManagerName column; matched against profiles.name.';

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
UPDATE call_logs c SET manager_id = l.manager_id FROM leads l WHERE c.lead_id = l.id AND c.manager_id IS NULL;

CREATE OR REPLACE FUNCTION public.create_manager_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', ''), 'manager')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_manager_profile();

INSERT INTO profiles (id, email, name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', ''), 'manager' FROM auth.users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Profile self or manager access" ON profiles;
CREATE POLICY "Profile self or manager access" ON profiles FOR SELECT
USING (id = auth.uid() OR manager_id = auth.uid());
DROP POLICY IF EXISTS "Managers can update their submanager profiles" ON profiles;
CREATE POLICY "Managers can update their submanager profiles" ON profiles FOR UPDATE
USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert their own leads" ON leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON leads;
DROP POLICY IF EXISTS "Managers and assigned submanagers view leads" ON leads;
DROP POLICY IF EXISTS "Managers insert leads" ON leads;
DROP POLICY IF EXISTS "Managers and assigned submanagers update leads" ON leads;
DROP POLICY IF EXISTS "Managers delete leads" ON leads;
CREATE POLICY "Managers and assigned submanagers view leads" ON leads FOR SELECT
USING (manager_id = auth.uid() OR submanager_id = auth.uid());
CREATE POLICY "Managers insert leads" ON leads FOR INSERT
WITH CHECK (manager_id = auth.uid() AND user_id = auth.uid());
CREATE POLICY "Managers and assigned submanagers update leads" ON leads FOR UPDATE
USING (manager_id = auth.uid() OR submanager_id = auth.uid())
WITH CHECK (manager_id = auth.uid() OR submanager_id = auth.uid());
CREATE POLICY "Managers delete leads" ON leads FOR DELETE
USING (manager_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can insert their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can update their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Users can delete their own call logs" ON call_logs;
DROP POLICY IF EXISTS "Caller and manager view call logs" ON call_logs;
DROP POLICY IF EXISTS "Caller inserts call logs for assigned leads" ON call_logs;
DROP POLICY IF EXISTS "Caller and manager update call logs" ON call_logs;
DROP POLICY IF EXISTS "Caller and manager delete call logs" ON call_logs;
CREATE POLICY "Caller and manager view call logs" ON call_logs FOR SELECT
USING (user_id = auth.uid() OR manager_id = auth.uid());
CREATE POLICY "Caller inserts call logs for assigned leads" ON call_logs FOR INSERT
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM leads l WHERE l.id = call_logs.lead_id AND l.manager_id = call_logs.manager_id
    AND (l.submanager_id = auth.uid() OR l.manager_id = auth.uid())
));
CREATE POLICY "Caller and manager update call logs" ON call_logs FOR UPDATE
USING (user_id = auth.uid() OR manager_id = auth.uid())
WITH CHECK (user_id = auth.uid() OR manager_id = auth.uid());
CREATE POLICY "Caller and manager delete call logs" ON call_logs FOR DELETE
USING (user_id = auth.uid() OR manager_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_leads_manager_id ON leads(manager_id);
CREATE INDEX IF NOT EXISTS idx_leads_submanager_id ON leads(submanager_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_manager_id ON call_logs(manager_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'call_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
  END IF;
END $$;
