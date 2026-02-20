-- Quote workflow hardening for server-side writes.
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMPTZ;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.enquiries ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_id UUID;

CREATE INDEX IF NOT EXISTS enquiries_status_idx ON public.enquiries (status);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON public.quotes (status);
CREATE INDEX IF NOT EXISTS quotes_enquiry_id_idx ON public.quotes (enquiry_id);
CREATE INDEX IF NOT EXISTS clients_email_lower_idx ON public.clients ((lower(email)));
CREATE INDEX IF NOT EXISTS clients_phone_digits_idx
  ON public.clients ((regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')));

CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START WITH 1 INCREMENT BY 1 MINVALUE 1;

DO $$
DECLARE
  v_max BIGINT;
BEGIN
  SELECT COALESCE(MAX((regexp_match(id, '^Q([0-9]+)$'))[1]::BIGINT), 0)
  INTO v_max
  FROM public.quotes;

  IF v_max < 1 THEN
    PERFORM setval('public.quote_number_seq', 1, false);
  ELSE
    PERFORM setval('public.quote_number_seq', v_max, true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_quote_for_enquiry(
  p_enquiry_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  quote_id TEXT,
  enquiry_id UUID,
  enquiry_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enquiry public.enquiries%ROWTYPE;
  v_existing_quote_id TEXT;
  v_quote_id TEXT;
  v_frequency TEXT;
  v_max BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(98170001);

  SELECT * INTO v_enquiry
  FROM public.enquiries
  WHERE id = p_enquiry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enquiry % not found', p_enquiry_id USING ERRCODE = 'P0002';
  END IF;

  IF v_enquiry.details IS NULL THEN
    RAISE EXCEPTION 'Enquiry % has no details', p_enquiry_id USING ERRCODE = '22023';
  END IF;

  SELECT q.id
  INTO v_existing_quote_id
  FROM public.quotes q
  WHERE q.enquiry_id = p_enquiry_id::TEXT
  ORDER BY q.created_at DESC
  LIMIT 1;

  IF v_existing_quote_id IS NOT NULL THEN
    UPDATE public.enquiries
      SET status = 'quote_ready',
          quote_id = v_existing_quote_id,
          updated_at = NOW()
    WHERE id = p_enquiry_id;

    RETURN QUERY
    SELECT v_existing_quote_id, p_enquiry_id, 'quote_ready'::TEXT;
    RETURN;
  END IF;

  SELECT COALESCE(MAX((regexp_match(id, '^Q([0-9]+)$'))[1]::BIGINT), 0)
  INTO v_max
  FROM public.quotes;

  IF v_max < 1 THEN
    PERFORM setval('public.quote_number_seq', 1, false);
  ELSE
    PERFORM setval('public.quote_number_seq', v_max, true);
  END IF;

  v_quote_id := 'Q' || LPAD(nextval('public.quote_number_seq')::TEXT, 3, '0');
  v_frequency := INITCAP(COALESCE(NULLIF(v_enquiry.details->>'frequency', ''), 'fortnightly'));

  INSERT INTO public.quotes (
    id, enquiry_id, name, channel, suburb, frequency, status, details, created_at, updated_at
  )
  VALUES (
    v_quote_id,
    p_enquiry_id::TEXT,
    v_enquiry.name,
    COALESCE(v_enquiry.channel, 'form'),
    v_enquiry.suburb,
    v_frequency,
    'pending_approval',
    v_enquiry.details,
    NOW(),
    NOW()
  );

  UPDATE public.enquiries
    SET status = 'quote_ready',
        quote_id = v_quote_id,
        updated_at = NOW()
  WHERE id = p_enquiry_id;

  RETURN QUERY
  SELECT v_quote_id, p_enquiry_id, 'quote_ready'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_quote_sent(
  p_quote_id TEXT,
  p_sent_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  quote_id TEXT,
  enquiry_id UUID,
  enquiry_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_enquiry_id UUID;
  v_effective_sent_at TIMESTAMPTZ;
BEGIN
  PERFORM pg_advisory_xact_lock(98170002);

  SELECT * INTO v_quote
  FROM public.quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id USING ERRCODE = 'P0002';
  END IF;

  v_effective_sent_at := COALESCE(p_sent_at, NOW());

  BEGIN
    v_enquiry_id := NULLIF(v_quote.enquiry_id, '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_enquiry_id := NULL;
  END;

  UPDATE public.quotes
    SET status = 'sent',
        sent_at = v_effective_sent_at,
        updated_at = NOW()
  WHERE id = p_quote_id;

  IF v_enquiry_id IS NOT NULL THEN
    UPDATE public.enquiries
      SET status = 'quote_sent',
          quote_sent_at = v_effective_sent_at,
          quote_id = p_quote_id,
          updated_at = NOW()
    WHERE id = v_enquiry_id;
  END IF;

  RETURN QUERY
  SELECT p_quote_id, v_enquiry_id, 'quote_sent'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_quote_and_upsert_client(
  p_quote_id TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  quote_id TEXT,
  enquiry_id UUID,
  enquiry_status TEXT,
  client_id UUID,
  client_name TEXT,
  client_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_enquiry public.enquiries%ROWTYPE;
  v_enquiry_id UUID;
  v_client_id UUID;
  v_details JSONB;
  v_name TEXT;
  v_email TEXT;
  v_phone TEXT;
  v_address TEXT;
  v_suburb TEXT;
  v_frequency TEXT;
  v_bedrooms INT;
  v_bathrooms INT;
  v_living INT;
  v_kitchen INT;
BEGIN
  PERFORM pg_advisory_xact_lock(98170003);

  SELECT * INTO v_quote
  FROM public.quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    v_enquiry_id := NULLIF(v_quote.enquiry_id, '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_enquiry_id := NULL;
  END;

  IF v_enquiry_id IS NOT NULL THEN
    SELECT * INTO v_enquiry
    FROM public.enquiries
    WHERE id = v_enquiry_id
    FOR UPDATE;
  END IF;

  v_details := COALESCE(v_enquiry.details, v_quote.details, '{}'::JSONB);
  v_name := COALESCE(NULLIF(v_enquiry.name, ''), NULLIF(v_quote.name, ''), 'Client');
  v_email := LOWER(NULLIF(TRIM(v_details->>'email'), ''));
  v_phone := NULLIF(regexp_replace(COALESCE(v_details->>'phone', ''), '[^0-9]', '', 'g'), '');
  v_address := NULLIF(TRIM(v_details->>'address'), '');
  v_suburb := COALESCE(NULLIF(v_enquiry.suburb, ''), NULLIF(v_quote.suburb, ''), NULLIF(TRIM(v_details->>'suburb'), ''));
  v_frequency := LOWER(COALESCE(NULLIF(TRIM(v_details->>'frequency'), ''), 'fortnightly'));
  v_bedrooms := COALESCE(NULLIF(v_details->>'bedrooms', '')::INT, 0);
  v_bathrooms := COALESCE(NULLIF(v_details->>'bathrooms', '')::INT, 0);
  v_living := COALESCE(NULLIF(v_details->>'living', '')::INT, 0);
  v_kitchen := COALESCE(NULLIF(v_details->>'kitchen', '')::INT, 0);

  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(v_email, v_phone, v_name)));

  SELECT c.id
  INTO v_client_id
  FROM public.clients c
  WHERE (v_email IS NOT NULL AND LOWER(c.email) = v_email)
     OR (v_phone IS NOT NULL AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone)
  ORDER BY c.created_at
  LIMIT 1
  FOR UPDATE;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      name, email, phone, address, suburb, bedrooms, bathrooms, living, kitchen,
      frequency, status, notes, access_notes, is_demo, created_at, updated_at
    )
    VALUES (
      v_name,
      v_email,
      CASE
        WHEN v_phone IS NULL THEN NULL
        ELSE '0' || SUBSTRING(v_phone FROM 2 FOR 3) || ' ' || SUBSTRING(v_phone FROM 5 FOR 3) || ' ' || SUBSTRING(v_phone FROM 8 FOR 3)
      END,
      v_address,
      v_suburb,
      v_bedrooms,
      v_bathrooms,
      v_living,
      v_kitchen,
      v_frequency,
      'active',
      NULLIF(TRIM(v_details->>'notes'), ''),
      NULLIF(TRIM(v_details->>'access_notes'), ''),
      false,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients
      SET name = COALESCE(NULLIF(v_name, ''), name),
          email = COALESCE(v_email, email),
          phone = COALESCE(
            CASE
              WHEN v_phone IS NULL THEN NULL
              ELSE '0' || SUBSTRING(v_phone FROM 2 FOR 3) || ' ' || SUBSTRING(v_phone FROM 5 FOR 3) || ' ' || SUBSTRING(v_phone FROM 8 FOR 3)
            END,
            phone
          ),
          address = COALESCE(v_address, address),
          suburb = COALESCE(v_suburb, suburb),
          bedrooms = COALESCE(NULLIF(v_bedrooms, 0), bedrooms),
          bathrooms = COALESCE(NULLIF(v_bathrooms, 0), bathrooms),
          living = COALESCE(NULLIF(v_living, 0), living),
          kitchen = COALESCE(NULLIF(v_kitchen, 0), kitchen),
          frequency = COALESCE(NULLIF(v_frequency, ''), frequency),
          status = 'active',
          updated_at = NOW()
    WHERE id = v_client_id;
  END IF;

  UPDATE public.quotes
    SET status = 'accepted',
        accepted_at = NOW(),
        client_id = v_client_id,
        updated_at = NOW()
  WHERE id = p_quote_id;

  IF v_enquiry_id IS NOT NULL THEN
    UPDATE public.enquiries
      SET status = 'accepted',
          accepted_at = NOW(),
          client_id = v_client_id,
          quote_id = p_quote_id,
          updated_at = NOW()
    WHERE id = v_enquiry_id;
  END IF;

  RETURN QUERY
  SELECT
    p_quote_id,
    v_enquiry_id,
    'accepted'::TEXT,
    v_client_id,
    v_name,
    'active'::TEXT;
END;
$$;

