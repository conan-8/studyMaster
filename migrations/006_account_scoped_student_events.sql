-- 006_account_scoped_student_events.sql — real accounts now exist (Supabase
-- Auth: email/password + Google OAuth). Student data is linked to the
-- account: every signed-in user can only read/write their own rows, where
-- student_id = their auth uid. Replaces the 005 dev-only anon policy.

DROP POLICY IF EXISTS "dev student events" ON student_events;

DROP POLICY IF EXISTS "own events read" ON student_events;
CREATE POLICY "own events read" ON student_events
  FOR SELECT TO authenticated
  USING (student_id = (auth.uid())::text);

DROP POLICY IF EXISTS "own events insert" ON student_events;
CREATE POLICY "own events insert" ON student_events
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (auth.uid())::text);

DROP POLICY IF EXISTS "own events update" ON student_events;
CREATE POLICY "own events update" ON student_events
  FOR UPDATE TO authenticated
  USING (student_id = (auth.uid())::text)
  WITH CHECK (student_id = (auth.uid())::text);

DROP POLICY IF EXISTS "own events delete" ON student_events;
CREATE POLICY "own events delete" ON student_events
  FOR DELETE TO authenticated
  USING (student_id = (auth.uid())::text);
