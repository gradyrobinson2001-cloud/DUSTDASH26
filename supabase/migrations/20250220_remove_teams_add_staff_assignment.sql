-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Remove teams/PINs, add per-job staff assignment
--
-- Changes:
--   1. Add assigned_staff (TEXT[]) to scheduled_jobs for per-job staff assignment
--   2. Add is_published (BOOLEAN) to scheduled_jobs for rota publishing
--   3. Drop team_id from scheduled_jobs, profiles, photos
--   4. Drop pin_hash from profiles
--   5. Drop rota table (replaced by per-job is_published)
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add new columns to scheduled_jobs ─────────────────────────────────
ALTER TABLE public.scheduled_jobs
  ADD COLUMN IF NOT EXISTS assigned_staff TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- ─── 2. Drop team_id from scheduled_jobs ──────────────────────────────────
ALTER TABLE public.scheduled_jobs DROP COLUMN IF EXISTS team_id;

-- ─── 3. Drop team_id and pin_hash from profiles ──────────────────────────
ALTER TABLE public.profiles DROP COLUMN IF EXISTS team_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pin_hash;

-- ─── 4. Drop team_id from photos ─────────────────────────────────────────
ALTER TABLE public.photos DROP COLUMN IF EXISTS team_id;

-- ─── 5. Drop rota table (no longer needed — replaced by is_published) ────
DROP TABLE IF EXISTS public.rota CASCADE;
