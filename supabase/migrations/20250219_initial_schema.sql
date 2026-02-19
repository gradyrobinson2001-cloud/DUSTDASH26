-- ═══════════════════════════════════════════════════════════════════════
-- DUSTDASH INITIAL SCHEMA
-- Run this in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Extensions ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ───────────────────────────────────────────────────────────
-- Already exists if you ran the quick-start SQL, but safe to re-run
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name        TEXT,
  email            TEXT,
  role             TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  team_id          TEXT,
  employment_type  TEXT DEFAULT 'casual' CHECK (employment_type IN ('casual', 'part_time', 'full_time')),
  hourly_rate      NUMERIC(8,2) DEFAULT 0,
  pin_hash         TEXT,
  is_active        BOOLEAN DEFAULT true,
  tfn_last4        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS on profiles so the anon key can read it (admin-only app)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- ─── CLIENTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  address          TEXT,
  suburb           TEXT,
  bedrooms         INTEGER DEFAULT 0,
  bathrooms        INTEGER DEFAULT 0,
  living           INTEGER DEFAULT 0,
  kitchen          INTEGER DEFAULT 0,
  frequency        TEXT DEFAULT 'fortnightly',
  preferred_day    TEXT,
  preferred_time   TEXT DEFAULT 'anytime',
  assigned_team    TEXT,
  estimated_duration INTEGER,
  custom_duration  INTEGER,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
  notes            TEXT,
  access_notes     TEXT,
  lat              NUMERIC(10,7),
  lng              NUMERIC(10,7),
  is_demo          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;

-- ─── ENQUIRIES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enquiries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  channel          TEXT DEFAULT 'messenger',
  suburb           TEXT,
  message          TEXT,
  status           TEXT DEFAULT 'new',
  avatar           TEXT,
  archived         BOOLEAN DEFAULT false,
  details          JSONB,
  quote_id         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.enquiries DISABLE ROW LEVEL SECURITY;

-- ─── QUOTES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotes (
  id               TEXT PRIMARY KEY,  -- Q001, Q002 etc
  enquiry_id       TEXT,
  name             TEXT,
  channel          TEXT,
  suburb           TEXT,
  frequency        TEXT,
  status           TEXT DEFAULT 'pending_approval',
  details          JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;

-- ─── INVOICES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number   TEXT UNIQUE,
  client_id        TEXT,
  client_name      TEXT,
  job_id           TEXT,
  items            JSONB DEFAULT '[]',
  subtotal         NUMERIC(10,2) DEFAULT 0,
  discount         NUMERIC(10,2) DEFAULT 0,
  total            NUMERIC(10,2) DEFAULT 0,
  status           TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue', 'cancelled')),
  due_date         DATE,
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;

-- ─── PAYMENTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        TEXT,
  client_name      TEXT,
  job_id           TEXT,
  invoice_id       TEXT,
  amount           NUMERIC(10,2) NOT NULL,
  method           TEXT DEFAULT 'cash',
  notes            TEXT,
  recorded_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- ─── EMAIL HISTORY ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        TEXT,
  client_name      TEXT,
  email            TEXT,
  template_type    TEXT,
  subject          TEXT,
  sent_at          TIMESTAMPTZ DEFAULT NOW(),
  status           TEXT DEFAULT 'sent',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_history DISABLE ROW LEVEL SECURITY;

-- ─── PRICING ────────────────────────────────────────────────────────────
-- Single-row config table (id=1 always)
CREATE TABLE IF NOT EXISTS public.pricing (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  data             JSONB NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pricing DISABLE ROW LEVEL SECURITY;

-- ─── TEMPLATES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.templates (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  content          TEXT NOT NULL,
  is_default       BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.templates DISABLE ROW LEVEL SECURITY;

-- ─── SCHEDULE SETTINGS ──────────────────────────────────────────────────
-- Single-row config table (id=1 always)
CREATE TABLE IF NOT EXISTS public.schedule_settings (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  data             JSONB NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.schedule_settings DISABLE ROW LEVEL SECURITY;

-- ─── SCHEDULED JOBS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date             DATE NOT NULL,
  client_id        TEXT,
  client_name      TEXT,
  suburb           TEXT,
  team_id          TEXT,
  start_time       TEXT,
  end_time         TEXT,
  duration         INTEGER,
  status           TEXT DEFAULT 'scheduled',
  is_demo          BOOLEAN DEFAULT false,
  is_break         BOOLEAN DEFAULT false,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.scheduled_jobs DISABLE ROW LEVEL SECURITY;

-- ─── PHOTOS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.photos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id           TEXT,
  client_id        TEXT,
  date             DATE,
  team_id          TEXT,
  type             TEXT DEFAULT 'before' CHECK (type IN ('before', 'after')),
  storage_path     TEXT NOT NULL,
  uploaded_by      TEXT,
  uploaded_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photos DISABLE ROW LEVEL SECURITY;

-- ─── PAYROLL RECORDS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start       DATE NOT NULL,
  hours_worked     NUMERIC(6,2) DEFAULT 0,
  jobs_completed   INTEGER DEFAULT 0,
  gross_pay        NUMERIC(10,2) DEFAULT 0,
  tax_withheld     NUMERIC(10,2) DEFAULT 0,
  net_pay          NUMERIC(10,2) DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, week_start)
);

ALTER TABLE public.payroll_records DISABLE ROW LEVEL SECURITY;

-- ─── PAYSLIPS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payslips (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start       DATE NOT NULL,
  pdf_url          TEXT,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payslips DISABLE ROW LEVEL SECURITY;

-- ─── ROTA ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rota (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_start       DATE NOT NULL,
  team_id          TEXT NOT NULL,
  is_published     BOOLEAN DEFAULT false,
  published_at     TIMESTAMPTZ,
  published_by     UUID REFERENCES public.profiles(id),
  overrides        JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start, team_id)
);

ALTER TABLE public.rota DISABLE ROW LEVEL SECURITY;

-- ─── Storage bucket for job photos ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', false)
ON CONFLICT (id) DO NOTHING;

-- ─── Seed default templates ──────────────────────────────────────────────
INSERT INTO public.templates (id, name, content, is_default, created_at) VALUES
  ('welcome',          'Welcome Reply',      'Hey! 👋 Thanks so much for reaching out to Dust Bunnies! We''d love to help get your home sparkling. Could you fill in our quick form so we can put together a personalised quote for you? [FORM LINK] 🌿', true, NOW()),
  ('quote_ready',      'Quote Ready',        'Hey {NAME}! 🌿 Great news — your personalised quote is ready! We''ve put together pricing for your {FREQUENCY} clean based on the details you shared. Take a look and let us know if you''d like to go ahead! 💚', true, NOW()),
  ('follow_up',        'Follow Up',          'Hey {NAME}! 👋 Just checking in — did you get a chance to look at the quote we sent through? Happy to answer any questions or make adjustments. No pressure at all! 🌿', true, NOW()),
  ('out_of_area',      'Out of Area',        'Hey! Thanks so much for getting in touch 💚 Unfortunately we don''t currently service your area, but we''re expanding soon! We''ll keep your details on file and reach out when we do. Wishing you all the best! 🌿', true, NOW()),
  ('booking_confirmed','Booking Confirmed',  'Yay! 🎉 You''re all booked in! We''re so excited to welcome you to the Dust Bunnies family. Your first clean is scheduled for [DATE]. See you then! 💚🌿', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- ─── Done! ───────────────────────────────────────────────────────────────
-- All tables created with RLS disabled (admin-only dashboard).
-- Your existing profiles row is preserved.
