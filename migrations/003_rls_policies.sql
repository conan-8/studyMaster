-- 003_rls_policies.sql — explicit RLS posture for the simulator/web client.
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.
--
-- Display content (subjects, taxonomy, misconceptions, diagram archetypes,
-- archetypes, the generated question bank) is public-read per the master
-- plan's RLS posture. Harvested Bluebook content gets a DEV-ONLY anon read
-- policy so the local simulator can show it — tighten before any public
-- launch (internal_eval content must not ship to students). Student data
-- tables are enabled with no policies: default-deny for anon/authenticated,
-- only service-role server jobs may touch them.

-- --- display content: public read -----------------------------------------
ALTER TABLE subjects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_nodes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE misconceptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_archetypes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE archetypes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_versions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read" ON subjects;
CREATE POLICY "public read" ON subjects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON taxonomy_nodes;
CREATE POLICY "public read" ON taxonomy_nodes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON misconceptions;
CREATE POLICY "public read" ON misconceptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON diagram_archetypes;
CREATE POLICY "public read" ON diagram_archetypes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON archetypes;
CREATE POLICY "public read" ON archetypes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON questions;
CREATE POLICY "public read" ON questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public read" ON question_versions;
CREATE POLICY "public read" ON question_versions FOR SELECT TO anon, authenticated USING (true);

-- --- Bluebook bank: DEV-ONLY anon read for the local simulator -------------
-- PRE-LAUNCH TODO: drop this policy; internal_eval content must not be
-- readable through any client-facing role.
DROP POLICY IF EXISTS "dev simulator read" ON bluebook_questions;
CREATE POLICY "dev simulator read" ON bluebook_questions FOR SELECT TO anon USING (true);

-- --- student data: default-deny until owner-scoped policies are designed ---
ALTER TABLE student_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery              ENABLE ROW LEVEL SECURITY;
ALTER TABLE misconception_stats  ENABLE ROW LEVEL SECURITY;
