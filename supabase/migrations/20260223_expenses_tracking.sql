-- ═════════════════════════════════════════════════════════════════════════════
-- Expenses Tracking (Phase 1)
-- Smart categorization + receipt metadata support.
-- Safe to re-run.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_claimable BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'uncategorized',
  status TEXT NOT NULL DEFAULT 'needs_review',
  payment_method TEXT NOT NULL DEFAULT 'card',
  notes TEXT NOT NULL DEFAULT '',
  receipt_data_url TEXT NOT NULL DEFAULT '',
  receipt_file_name TEXT NOT NULL DEFAULT '',
  ai_suggested_category TEXT NOT NULL DEFAULT '',
  ai_confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  ai_reasoning TEXT NOT NULL DEFAULT '',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS vendor TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_claimable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_data_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS receipt_file_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_suggested_category TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_reasoning TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.expenses
SET
  expense_date = COALESCE(expense_date, CURRENT_DATE),
  vendor = COALESCE(vendor, ''),
  amount = COALESCE(amount, 0),
  gst_amount = COALESCE(gst_amount, 0),
  gst_claimable = COALESCE(gst_claimable, true),
  category = COALESCE(NULLIF(category, ''), 'uncategorized'),
  status = COALESCE(NULLIF(status, ''), 'needs_review'),
  payment_method = COALESCE(NULLIF(payment_method, ''), 'card'),
  notes = COALESCE(notes, ''),
  receipt_data_url = COALESCE(receipt_data_url, ''),
  receipt_file_name = COALESCE(receipt_file_name, ''),
  ai_suggested_category = COALESCE(ai_suggested_category, ''),
  ai_confidence = COALESCE(ai_confidence, 0),
  ai_reasoning = COALESCE(ai_reasoning, ''),
  is_recurring = COALESCE(is_recurring, false),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  expense_date IS NULL
  OR vendor IS NULL
  OR amount IS NULL
  OR gst_amount IS NULL
  OR gst_claimable IS NULL
  OR category IS NULL
  OR status IS NULL
  OR payment_method IS NULL
  OR notes IS NULL
  OR receipt_data_url IS NULL
  OR receipt_file_name IS NULL
  OR ai_suggested_category IS NULL
  OR ai_confidence IS NULL
  OR ai_reasoning IS NULL
  OR is_recurring IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.expenses
  ALTER COLUMN expense_date SET NOT NULL,
  ALTER COLUMN vendor SET NOT NULL,
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN gst_amount SET NOT NULL,
  ALTER COLUMN gst_claimable SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN payment_method SET NOT NULL,
  ALTER COLUMN notes SET NOT NULL,
  ALTER COLUMN receipt_data_url SET NOT NULL,
  ALTER COLUMN receipt_file_name SET NOT NULL,
  ALTER COLUMN ai_suggested_category SET NOT NULL,
  ALTER COLUMN ai_confidence SET NOT NULL,
  ALTER COLUMN ai_reasoning SET NOT NULL,
  ALTER COLUMN is_recurring SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_amount_non_negative'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_amount_non_negative CHECK (amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_gst_amount_non_negative'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_gst_amount_non_negative CHECK (gst_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_ai_confidence_range'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_ai_confidence_range CHECK (ai_confidence >= 0 AND ai_confidence <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_status_check'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_status_check CHECK (status IN ('needs_review', 'approved', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_payment_method_check'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_payment_method_check CHECK (payment_method IN ('bank', 'card', 'cash', 'direct_debit', 'other'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_expenses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.set_expenses_updated_at();

CREATE INDEX IF NOT EXISTS expenses_date_created_idx
  ON public.expenses (expense_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS expenses_status_confidence_idx
  ON public.expenses (status, ai_confidence);

CREATE INDEX IF NOT EXISTS expenses_category_idx
  ON public.expenses (category);

CREATE INDEX IF NOT EXISTS expenses_vendor_idx
  ON public.expenses (lower(vendor));

ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;

-- Monthly budget targets per category (including 'all')
CREATE TABLE IF NOT EXISTS public.expense_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'all',
  budget_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.expense_budgets
  ADD COLUMN IF NOT EXISTS month_key TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.expense_budgets
SET
  month_key = COALESCE(NULLIF(month_key, ''), TO_CHAR(NOW(), 'YYYY-MM')),
  category = COALESCE(NULLIF(category, ''), 'all'),
  budget_amount = COALESCE(budget_amount, 0),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE
  month_key IS NULL
  OR month_key = ''
  OR category IS NULL
  OR category = ''
  OR budget_amount IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

ALTER TABLE public.expense_budgets
  ALTER COLUMN month_key SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN budget_amount SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expense_budgets_month_key_check'
      AND conrelid = 'public.expense_budgets'::regclass
  ) THEN
    ALTER TABLE public.expense_budgets
      ADD CONSTRAINT expense_budgets_month_key_check
      CHECK (month_key ~ '^\d{4}\-\d{2}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expense_budgets_amount_non_negative'
      AND conrelid = 'public.expense_budgets'::regclass
  ) THEN
    ALTER TABLE public.expense_budgets
      ADD CONSTRAINT expense_budgets_amount_non_negative CHECK (budget_amount >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS expense_budgets_month_category_uidx
  ON public.expense_budgets (month_key, category);

CREATE INDEX IF NOT EXISTS expense_budgets_month_idx
  ON public.expense_budgets (month_key DESC);

CREATE OR REPLACE FUNCTION public.set_expense_budgets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_budgets_updated_at ON public.expense_budgets;
CREATE TRIGGER trg_expense_budgets_updated_at
BEFORE UPDATE ON public.expense_budgets
FOR EACH ROW
EXECUTE FUNCTION public.set_expense_budgets_updated_at();

ALTER TABLE public.expense_budgets DISABLE ROW LEVEL SECURITY;
