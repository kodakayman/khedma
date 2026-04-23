-- ============================================================
-- KHEDMA — Supabase Schema + RLS
-- Tangier MVP
-- ============================================================
-- Run this in your Supabase project → SQL Editor
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Drop existing tables (clean slate) ──────────────────────
DROP TABLE IF EXISTS jobs    CASCADE;
DROP TABLE IF EXISTS workers CASCADE;

-- ── jobs ────────────────────────────────────────────────────
CREATE TABLE jobs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  category       TEXT        NOT NULL,   -- matches CONFIG.CATEGORIES[].id in shared.js
  district       TEXT        NOT NULL,   -- matches CONFIG.DISTRICTS[].id in shared.js
  description    TEXT,
  date           DATE,
  start_time     TIME,
  duration_hours NUMERIC(4,1),
  pay            INTEGER     NOT NULL,   -- single number in MAD
  poster_phone   TEXT        NOT NULL,   -- WhatsApp number, E.164 preferred
  referral_code  TEXT,                   -- optional, for café outreach tracking
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── workers ─────────────────────────────────────────────────
CREATE TABLE workers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL UNIQUE,   -- WhatsApp, E.164 preferred
  skill      TEXT,                           -- matches CONFIG.CATEGORIES[].id
  district   TEXT,                           -- matches CONFIG.DISTRICTS[].id
  bio        TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_jobs_category   ON jobs (category);
CREATE INDEX idx_jobs_district   ON jobs (district);
CREATE INDEX idx_jobs_is_active  ON jobs (is_active);
CREATE INDEX idx_jobs_created_at ON jobs (created_at DESC);
CREATE INDEX idx_workers_skill   ON workers (skill);
CREATE INDEX idx_workers_active  ON workers (is_active);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- ── jobs RLS ────────────────────────────────────────────────

-- Anyone can browse jobs (no auth required)
CREATE POLICY "jobs_select_public"
  ON jobs FOR SELECT
  USING (true);

-- ┌──────────────────────────────────────────────────────────┐
-- │ INSERT policy — two versions:                            │
-- │                                                          │
-- │ CURRENT (no OTP auth): allow all inserts.                │
-- │ Swap to the OTP version once you add Supabase Phone Auth.│
-- └──────────────────────────────────────────────────────────┘

-- CURRENT: no auth — allow all inserts (remove when OTP is live)
CREATE POLICY "jobs_insert_anon"
  ON jobs FOR INSERT
  WITH CHECK (true);

-- OTP-READY (uncomment + drop jobs_insert_anon after enabling Phone Auth):
-- CREATE POLICY "jobs_insert_phone_match"
--   ON jobs FOR INSERT
--   WITH CHECK (poster_phone = auth.jwt() ->> 'phone');

-- Only the poster can deactivate their own job
-- Requires phone auth to be active — leave commented until OTP is live
-- CREATE POLICY "jobs_update_own"
--   ON jobs FOR UPDATE
--   USING (poster_phone = auth.jwt() ->> 'phone');


-- ── workers RLS ─────────────────────────────────────────────

-- Anyone can browse workers
CREATE POLICY "workers_select_public"
  ON workers FOR SELECT
  USING (true);

-- CURRENT: no auth — allow all inserts
CREATE POLICY "workers_insert_anon"
  ON workers FOR INSERT
  WITH CHECK (true);

-- OTP-READY (uncomment + drop workers_insert_anon after enabling Phone Auth):
-- CREATE POLICY "workers_insert_phone_match"
--   ON workers FOR INSERT
--   WITH CHECK (phone = auth.jwt() ->> 'phone');

-- Only the worker can update their own row
-- CREATE POLICY "workers_update_own"
--   ON workers FOR UPDATE
--   USING (phone = auth.jwt() ->> 'phone');


-- ── Realtime ────────────────────────────────────────────────
-- Enable Realtime for the jobs table so new posts appear live
-- Run this in Supabase Dashboard → Database → Replication
-- Or uncomment if your Supabase version supports it via SQL:
--
-- ALTER PUBLICATION supabase_realtime ADD TABLE jobs;


-- ── Sample data (optional — delete before going live) ────────
/*
INSERT INTO jobs (title, category, district, description, date, start_time, duration_hours, pay, poster_phone, referral_code) VALUES
  ('نادل لكافيه نهاية الأسبوع', 'cafe-waiter',      'centre-ville', 'نبحث عن نادل محترف لكافيه في وسط المدينة.', CURRENT_DATE + 1, '09:00', 8, 250, '+212600000001', NULL),
  ('عامل تنظيف منازل',          'cleaning',         'malabata',     'تنظيف فيلا كبيرة. الأدوات متوفرة.', CURRENT_DATE + 2, '08:00', 6, 200, '+212600000002', 'REF-CAFE1'),
  ('نادل مطعم ليلي',             'restaurant-staff', 'iberia',       'خبرة في الخدمة مطلوبة. اللباس الرسمي متوفر.', CURRENT_DATE,     '19:00', 5, 180, '+212600000003', NULL);

INSERT INTO workers (name, phone, skill, district, bio) VALUES
  ('أحمد بنعلي',  '+212611111111', 'cafe-waiter',      'centre-ville', 'خبرة 3 سنوات في الكافيهات والمطاعم بطنجة.'),
  ('فاطمة الزهراء', '+212622222222', 'cleaning',        'malabata',     'متخصصة في تنظيف المنازل والفيلات.'),
  ('يوسف المريني', '+212633333333', 'restaurant-staff', 'branes',       'نادل محترف مع خبرة في المطاعم الراقية.');
*/
