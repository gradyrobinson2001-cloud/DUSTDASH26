-- ═════════════════════════════════════════════════════════════════════════════
-- Staff Broadcasts
-- Global owner/admin messages visible across all staff portals.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.staff_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'info',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_broadcasts_tone_check'
      AND conrelid = 'public.staff_broadcasts'::regclass
  ) THEN
    ALTER TABLE public.staff_broadcasts
      ADD CONSTRAINT staff_broadcasts_tone_check
      CHECK (tone IN ('info', 'warning', 'urgent'));
  END IF;
END $$;

ALTER TABLE public.staff_broadcasts DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS staff_broadcasts_active_created_idx
  ON public.staff_broadcasts (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS staff_broadcasts_expires_idx
  ON public.staff_broadcasts (expires_at);
