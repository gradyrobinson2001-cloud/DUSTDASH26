-- Floor plan schema backfill (safe to re-run)
-- Use this when environments missed earlier floor plan migrations.

ALTER TABLE public.floor_plans
  ADD COLUMN IF NOT EXISTS color_legend JSONB NOT NULL DEFAULT '[
    {"id":"light","label":"Light","color":"#BFE3C8"},
    {"id":"standard","label":"Standard","color":"#BFD7EF"},
    {"id":"heavy","label":"Heavy","color":"#F0D1AE"},
    {"id":"deep_clean","label":"Deep Clean","color":"#EAB6B6"}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS house_sections JSONB NOT NULL DEFAULT '[
    {"id":"main","label":"Main"},
    {"id":"upstairs","label":"Upstairs"},
    {"id":"downstairs","label":"Downstairs"},
    {"id":"outbuilding","label":"Outbuilding"}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS reference_image_path TEXT,
  ADD COLUMN IF NOT EXISTS reference_image_updated_at TIMESTAMPTZ;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS section_key TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS doors JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS rooms_floor_section_idx
  ON public.rooms (floor_plan_id, section_key);
