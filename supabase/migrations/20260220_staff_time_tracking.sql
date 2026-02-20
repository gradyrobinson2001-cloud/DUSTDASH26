-- Staff clock in/out tracking + actual job timing support
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.staff_time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 30 CHECK (break_minutes >= 0 AND break_minutes <= 180),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'staff_portal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, work_date)
);

ALTER TABLE public.staff_time_entries DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS staff_time_entries_staff_date_idx
  ON public.staff_time_entries (staff_id, work_date);

CREATE INDEX IF NOT EXISTS staff_time_entries_work_date_idx
  ON public.staff_time_entries (work_date);

ALTER TABLE public.scheduled_jobs
  ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_duration INTEGER;
