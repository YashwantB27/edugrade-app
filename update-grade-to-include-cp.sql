-- ============================================================
-- Migration: Allow 'CP' in subjects grade check constraint
-- ============================================================

ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS subjects_grade_check;

ALTER TABLE subjects
ADD CONSTRAINT subjects_grade_check
CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'E', 'F', 'Completed', 'CP'));
