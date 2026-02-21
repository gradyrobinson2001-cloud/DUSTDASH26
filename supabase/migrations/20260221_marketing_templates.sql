-- ═════════════════════════════════════════════════════════════════════════════
-- AI Marketing Studio templates
-- Stores reusable campaign prompt/template definitions for admins.
-- Safe to re-run.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.marketing_templates
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS prompt TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.marketing_templates
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN prompt SET NOT NULL,
  ALTER COLUMN data SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS marketing_templates_updated_idx
  ON public.marketing_templates (updated_at DESC);

CREATE INDEX IF NOT EXISTS marketing_templates_created_by_idx
  ON public.marketing_templates (created_by);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.marketing_templates
  TO authenticated, service_role;

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_templates_admin_select ON public.marketing_templates;
DROP POLICY IF EXISTS marketing_templates_admin_insert ON public.marketing_templates;
DROP POLICY IF EXISTS marketing_templates_admin_update ON public.marketing_templates;
DROP POLICY IF EXISTS marketing_templates_admin_delete ON public.marketing_templates;

CREATE POLICY marketing_templates_admin_select
  ON public.marketing_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND COALESCE(p.is_active, TRUE)
    )
  );

CREATE POLICY marketing_templates_admin_insert
  ON public.marketing_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND COALESCE(p.is_active, TRUE)
    )
  );

CREATE POLICY marketing_templates_admin_update
  ON public.marketing_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND COALESCE(p.is_active, TRUE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND COALESCE(p.is_active, TRUE)
    )
  );

CREATE POLICY marketing_templates_admin_delete
  ON public.marketing_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND COALESCE(p.is_active, TRUE)
    )
  );
