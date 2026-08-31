-- 002_bluebook_questions.sql — separate store for harvested Bluebook/SSQB questions.
-- Idempotent: safe to re-run.
--
-- Generated/original questions live in questions + question_versions (the
-- display bank). Harvested College Board content lives HERE instead: same
-- Postgres, separate table, allowed_uses internal_eval only, RLS default-deny
-- so it can never be read through the public anon/authenticated roles.

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'generated'
    CHECK (source IN ('generated'));

CREATE TABLE IF NOT EXISTS bluebook_questions (
  source_id           TEXT PRIMARY KEY,          -- ssqb-<College Board id>
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

-- Harvested content is internal-eval only: lock the table down for every
-- client role; only service-role/server jobs may touch it.
ALTER TABLE bluebook_questions ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: anon + authenticated roles get nothing.
