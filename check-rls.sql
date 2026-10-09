-- Check if RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'semesters', 'subjects', 'attendance', 'targets')
ORDER BY tablename;

-- Expected result: rls_enabled should be 't' (true) for all tables
