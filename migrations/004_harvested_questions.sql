-- 004_harvested_questions.sql — three-kind question model.
-- Idempotent: safe to re-run.
--
-- The bank splits harvested College Board content into two kinds:
--   origin='bluebook'      — the question appears in a Bluebook practice exam
--   origin='question_bank' — general online (SSQB) question-bank item
-- Generated/original content stays in questions + question_versions
-- (source='generated'). This migration renames the 002 bluebook_questions
-- table to harvested_questions and adds the origin column; the dev anon read
-- policy moves with it.

CREATE TABLE IF NOT EXISTS harvested_questions (
  source_id           TEXT PRIMARY KEY,          -- ssqb-<College Board id>
  origin              TEXT NOT NULL CHECK (origin IN ('bluebook', 'question_bank')),
  section             TEXT NOT NULL CHECK (section IN ('reading-writing', 'math')),
  domain              TEXT NOT NULL,
  skill               TEXT NOT NULL,
  difficulty_official TEXT NOT NULL CHECK (difficulty_official IN ('easy', 'medium', 'hard')),
  difficulty_internal INT  NOT NULL CHECK (difficulty_internal IN (2, 3, 4)),
  question_type       TEXT NOT NULL CHECK (question_type IN ('mcq', 'grid_in')),
  payload             JSONB NOT NULL,            -- full normalized record (research/sat/question.schema.json)
  allowed_uses        TEXT[] NOT NULL DEFAULT '{internal_eval}'
                        CHECK (allowed_uses <@ '{internal_eval}'::text[]),
  source_url          TEXT NOT NULL,
  harvested_at        TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE harvested_questions ENABLE ROW LEVEL SECURITY;

-- DEV-ONLY anon read for the local simulator — PRE-LAUNCH TODO: drop it.
DROP POLICY IF EXISTS "dev simulator read" ON harvested_questions;
CREATE POLICY "dev simulator read" ON harvested_questions FOR SELECT TO anon USING (true);

-- Carry over anything seeded into the 002 table, then drop it.
DO $$
BEGIN
  IF to_regclass('public.bluebook_questions') IS NOT NULL THEN
    INSERT INTO harvested_questions
      (source_id, origin, section, domain, skill, difficulty_official, difficulty_internal,
       question_type, payload, allowed_uses, source_url, harvested_at, created_at)
    SELECT source_id,
           COALESCE(payload->>'origin', 'question_bank'),
           section, domain, skill, difficulty_official, difficulty_internal,
           question_type, payload, allowed_uses, source_url, harvested_at, created_at
    FROM bluebook_questions
    ON CONFLICT (source_id) DO NOTHING;
    DROP TABLE bluebook_questions;
  END IF;
END $$;
