-- Floor plan customization update:
-- 1) owner-defined color legend
-- 2) optional reference image upload
-- Safe to re-run.

ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS color_legend JSONB NOT NULL DEFAULT '[
    {"id":"light","label":"Light","color":"#BFE3C8"},
    {"id":"standard","label":"Standard","color":"#BFD7EF"},
    {"id":"heavy","label":"Heavy","color":"#F0D1AE"},
    {"id":"deep_clean","label":"Deep Clean","color":"#EAB6B6"}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS reference_image_path TEXT,
  ADD COLUMN IF NOT EXISTS reference_image_updated_at TIMESTAMPTZ;

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_difficulty_level_check;

ALTER TABLE public.rooms
  ALTER COLUMN difficulty_level TYPE TEXT USING difficulty_level::text,
  ALTER COLUMN difficulty_level SET DEFAULT 'standard';

INSERT INTO storage.buckets (id, name, public)
VALUES ('floorplan-images', 'floorplan-images', false)
ON CONFLICT (id) DO NOTHING;
