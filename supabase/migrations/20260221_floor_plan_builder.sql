-- Floor plan builder MVP schema
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.floor_plans DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  floor_plan_id UUID NOT NULL REFERENCES public.floor_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Room',
  x INTEGER NOT NULL DEFAULT 40,
  y INTEGER NOT NULL DEFAULT 40,
  width INTEGER NOT NULL DEFAULT 200 CHECK (width >= 80),
  height INTEGER NOT NULL DEFAULT 140 CHECK (height >= 80),
  difficulty_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (difficulty_level IN ('light', 'standard', 'heavy', 'deep_clean')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.room_pins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  x NUMERIC(6,4) NOT NULL CHECK (x >= 0 AND x <= 1),
  y NUMERIC(6,4) NOT NULL CHECK (y >= 0 AND y <= 1),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.room_pins DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS floor_plans_client_idx ON public.floor_plans(client_id);
CREATE INDEX IF NOT EXISTS rooms_floor_plan_idx ON public.rooms(floor_plan_id);
CREATE INDEX IF NOT EXISTS room_pins_room_idx ON public.room_pins(room_id);
