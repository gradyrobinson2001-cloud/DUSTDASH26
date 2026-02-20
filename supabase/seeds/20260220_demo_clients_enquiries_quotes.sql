-- Deterministic demo seed for Clients + Enquiries + Quotes.
-- Safe to re-run: stable IDs + ON CONFLICT upserts.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS pg_temp.demo_seed;
CREATE TEMP TABLE demo_seed ON COMMIT DROP AS
WITH
  cfg AS (
    SELECT
      'b3f65ad8-9e20-4f37-bf22-12f5b9db1d5a'::UUID AS ns,
      ARRAY[
        'Olivia','Charlotte','Amelia','Isla','Mia','Ava','Grace','Sophie','Matilda','Ruby',
        'Jack','Noah','Liam','William','Lucas','James','Henry','Harper','Ella','Zoe',
        'Ethan','Mason','Leo','Archie','Hudson','Chloe','Evie','Georgia','Hannah','Lily',
        'Cooper','Thomas','Benjamin','Oscar','Charlie','Mila','Scarlett','Aria','Layla','Poppy',
        'Connor','Harrison','Flynn','Asher','Nate'
      ]::TEXT[] AS first_names,
      ARRAY[
        'Anderson','Bennett','Campbell','Davies','Edwards','Fletcher','Graham','Hughes','Iverson','Johnson',
        'Kennedy','Lawson','Mitchell','Nguyen','O''Brien','Parker','Quinn','Roberts','Stewart','Turner',
        'Underwood','Vaughan','Walker','Xavier','Young','Zimmerman','Baker','Collins','Dawson','Ellis',
        'Foster','Griffin','Harris','Irwin','Jameson','King','Lewis','Martin','Nolan','Owens',
        'Patel','Reid','Sullivan','Taylor','Wilson'
      ]::TEXT[] AS last_names,
      ARRAY[
        'Twin Waters','Maroochydore','Kuluin','Forest Glen','Mons',
        'Buderim','Alexandra Headland','Mooloolaba','Mountain Creek','Minyama'
      ]::TEXT[] AS suburbs,
      ARRAY['gmail.com','outlook.com','icloud.com','hotmail.com','yahoo.com.au']::TEXT[] AS domains,
      ARRAY['standard_clean','bond_clean','deep_clean']::TEXT[] AS service_types,
      ARRAY['weekly','fortnightly','monthly']::TEXT[] AS frequencies
  ),
  seed AS (
    SELECT i
    FROM generate_series(1, 70) AS g(i)
  ),
  rows AS (
    SELECT
      s.i,
      uuid_generate_v5(cfg.ns, 'demo-client-' || s.i) AS client_id,
      uuid_generate_v5(cfg.ns, 'demo-enquiry-' || s.i) AS enquiry_id,
      'DQ' || LPAD(s.i::TEXT, 3, '0') AS quote_id,
      cfg.first_names[((s.i - 1) % array_length(cfg.first_names, 1)) + 1] AS first_name,
      cfg.last_names[((s.i - 1) % array_length(cfg.last_names, 1)) + 1] AS last_name,
      cfg.suburbs[((s.i - 1) % array_length(cfg.suburbs, 1)) + 1] AS suburb,
      cfg.domains[((s.i - 1) % array_length(cfg.domains, 1)) + 1] AS domain,
      cfg.service_types[((s.i - 1) % array_length(cfg.service_types, 1)) + 1] AS service_type,
      cfg.frequencies[((s.i - 1) % array_length(cfg.frequencies, 1)) + 1] AS frequency
    FROM seed s
    CROSS JOIN cfg
  )
SELECT
  i,
  client_id,
  enquiry_id,
  quote_id,
  first_name,
  last_name,
  first_name || ' ' || last_name AS full_name,
  service_type,
  frequency,
  suburb,
  CASE suburb
    WHEN 'Twin Waters' THEN (ARRAY['Oceanside Dr','Lakeside Ave','Sailfish Ct','Pelican Way','Marina Blvd','Harbour Dr','Seaspray Cres'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Maroochydore' THEN (ARRAY['Aerodrome Rd','Duporth Ave','Dalton Dr','Cotton Tree Pde','Picnic Point Esp','Bradman Ave','Memorial Ave'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Kuluin' THEN (ARRAY['Kuluin St','Rosebed St','Lumeah Dr','Anne St','Valroy Dr','Sunshine Ct','Hilltop Ave'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Forest Glen' THEN (ARRAY['Forest Glen Rd','Doolan St','Vise Rd','Anning Rd','Balmoral Rd','Creekside Dr','Ironbark Pl'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Mons' THEN (ARRAY['Mons Rd','Sunrise Rd','Panorama Dr','Ridgewood Ct','Mountain View Dr','Valley Cres','Hilltop Ct'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Buderim' THEN (ARRAY['Burnett St','King St','Lindsay Rd','Gloucester Rd','Main St','Crosby Hill Rd','Ballinger Rd'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Alexandra Headland' THEN (ARRAY['Alexandra Pde','Okinja Rd','Mary St','Pacific Tce','Albatross Ave','Hill St','Beach Rd'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Mooloolaba' THEN (ARRAY['Smith St','Brisbane Rd','Walan St','Meta St','Foote St','River Esp','Parkyn Pde'])[ ((i - 1) % 7) + 1 ]
    WHEN 'Mountain Creek' THEN (ARRAY['Karawatha Dr','Mountain Creek Rd','Glenfields Blvd','Brookfield Dr','Parklands Blvd','Creekwood Ct','Lakewood Dr'])[ ((i - 1) % 7) + 1 ]
    ELSE (ARRAY['Jessica Blvd','Minyama St','Glenyce Ct','Brittany Dr','Windsong Pl','The Anchorage','Doone Ct'])[ ((i - 1) % 7) + 1 ]
  END AS street,
  CASE suburb
    WHEN 'Twin Waters' THEN '4564'
    WHEN 'Maroochydore' THEN '4558'
    WHEN 'Kuluin' THEN '4558'
    WHEN 'Forest Glen' THEN '4556'
    WHEN 'Mons' THEN '4556'
    WHEN 'Buderim' THEN '4556'
    WHEN 'Alexandra Headland' THEN '4572'
    WHEN 'Mooloolaba' THEN '4557'
    WHEN 'Mountain Creek' THEN '4557'
    WHEN 'Minyama' THEN '4575'
    ELSE '4557'
  END AS postcode,
  (7 + ((i * 17 + 31) % 220)) AS street_number,
  LOWER(regexp_replace(first_name || '.' || last_name, '[^A-Za-z.]', '', 'g')) || '@' || domain AS email,
  (
    SELECT
      '0' || substr(mobile_digits, 1, 3) || ' ' || substr(mobile_digits, 4, 3) || ' ' || substr(mobile_digits, 7, 3)
    FROM (SELECT (400000000 + i * 173)::TEXT AS mobile_digits) p
  ) AS phone,
  CASE WHEN (i % 3) = 0 THEN 4 WHEN (i % 3) = 1 THEN 3 ELSE 2 END AS bedrooms,
  CASE WHEN (i % 4) = 0 THEN 3 WHEN (i % 2) = 0 THEN 2 ELSE 1 END AS bathrooms,
  CASE WHEN (i % 5) = 0 THEN 2 ELSE 1 END AS living,
  1 AS kitchen,
  'active' AS client_status,
  CASE
    WHEN i <= 48 THEN 'accepted'
    WHEN i <= 62 THEN 'quote_sent'
    ELSE 'quote_ready'
  END AS enquiry_status,
  CASE
    WHEN i <= 48 THEN 'accepted'
    WHEN i <= 62 THEN 'sent'
    ELSE 'pending_approval'
  END AS quote_status,
  NOW() - (((i * 4) % 180) || ' days')::INTERVAL AS created_at
FROM rows;

INSERT INTO public.clients (
  id, name, email, phone, address, suburb, bedrooms, bathrooms, living, kitchen,
  frequency, preferred_day, preferred_time, status, notes, access_notes, is_demo, created_at, updated_at
)
SELECT
  client_id,
  full_name,
  email,
  phone,
  street_number || ' ' || street || ', ' || suburb || ' QLD ' || postcode,
  suburb,
  bedrooms,
  bathrooms,
  living,
  kitchen,
  frequency,
  (ARRAY['monday','tuesday','wednesday','thursday','friday'])[ ((i - 1) % 5) + 1 ],
  (ARRAY['morning','afternoon','anytime'])[ ((i - 1) % 3) + 1 ],
  client_status,
  CASE
    WHEN service_type = 'bond_clean' THEN 'Bond clean requested for end-of-lease handover.'
    WHEN service_type = 'deep_clean' THEN 'Client requested detailed kitchen and bathroom sanitising.'
    ELSE 'Standard recurring clean with family-friendly products.'
  END,
  CASE
    WHEN (i % 4) = 0 THEN 'Key in lockbox near front door.'
    WHEN (i % 4) = 1 THEN 'Ring bell once and enter via side gate.'
    WHEN (i % 4) = 2 THEN 'Spare key with neighbour at number 12.'
    ELSE 'Rear sliding door unlocked on clean day.'
  END,
  true,
  created_at,
  created_at
FROM demo_seed
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  suburb = EXCLUDED.suburb,
  bedrooms = EXCLUDED.bedrooms,
  bathrooms = EXCLUDED.bathrooms,
  living = EXCLUDED.living,
  kitchen = EXCLUDED.kitchen,
  frequency = EXCLUDED.frequency,
  preferred_day = EXCLUDED.preferred_day,
  preferred_time = EXCLUDED.preferred_time,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  access_notes = EXCLUDED.access_notes,
  is_demo = EXCLUDED.is_demo,
  updated_at = NOW();

INSERT INTO public.enquiries (
  id, name, channel, suburb, message, status, avatar, archived, details, quote_id, created_at, updated_at
)
SELECT
  enquiry_id,
  full_name,
  'form',
  suburb,
  CASE
    WHEN service_type = 'bond_clean' THEN 'Need an end-of-lease bond clean with receipt for property manager.'
    WHEN service_type = 'deep_clean' THEN 'Looking for a one-off deep clean before family visits.'
    ELSE 'Looking for a reliable cleaner for ongoing home cleaning.'
  END,
  enquiry_status,
  substr(first_name, 1, 1) || substr(last_name, 1, 1),
  false,
  jsonb_build_object(
    'name', full_name,
    'email', email,
    'phone', phone,
    'suburb', suburb,
    'address', street_number || ' ' || street || ', ' || suburb || ' QLD ' || postcode,
    'service_type', service_type,
    'frequency', frequency,
    'bedrooms', bedrooms,
    'bathrooms', bathrooms,
    'living', living,
    'kitchen', kitchen,
    'notes', CASE WHEN service_type = 'bond_clean' THEN 'Please include oven and windows.' ELSE 'Please use eco products where possible.' END,
    'submittedAt', created_at
  ),
  quote_id,
  created_at,
  created_at
FROM demo_seed
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  suburb = EXCLUDED.suburb,
  message = EXCLUDED.message,
  status = EXCLUDED.status,
  avatar = EXCLUDED.avatar,
  archived = EXCLUDED.archived,
  details = EXCLUDED.details,
  quote_id = EXCLUDED.quote_id,
  updated_at = NOW();

INSERT INTO public.quotes (
  id, enquiry_id, name, channel, suburb, frequency, status, details, created_at, updated_at
)
SELECT
  quote_id,
  enquiry_id::TEXT,
  full_name,
  'form',
  suburb,
  INITCAP(replace(frequency, '_', ' ')),
  quote_status,
  jsonb_build_object(
    'frequency', frequency,
    'service_type', service_type,
    'bedrooms', bedrooms,
    'bathrooms', bathrooms,
    'living', living,
    'kitchen', kitchen,
    'oven', (service_type = 'bond_clean'),
    'windows', (service_type <> 'standard_clean'),
    'windowsCount', CASE WHEN service_type = 'deep_clean' THEN 8 WHEN service_type = 'bond_clean' THEN 10 ELSE 4 END,
    'organising', (service_type = 'deep_clean')
  ),
  created_at + INTERVAL '1 day',
  created_at + INTERVAL '1 day'
FROM demo_seed
ON CONFLICT (id) DO UPDATE
SET
  enquiry_id = EXCLUDED.enquiry_id,
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  suburb = EXCLUDED.suburb,
  frequency = EXCLUDED.frequency,
  status = EXCLUDED.status,
  details = EXCLUDED.details,
  updated_at = NOW();

COMMIT;
