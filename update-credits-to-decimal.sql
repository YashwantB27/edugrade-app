-- ============================================================
-- Migration: Update credits column to support decimal values
-- Date: 2026-10-02
-- ============================================================

-- Alter the credits column in subjects table to support decimal values
ALTER TABLE subjects
ALTER COLUMN credits TYPE NUMERIC(4, 2);

-- Update the check constraint to allow decimal values
ALTER TABLE subjects
DROP CONSTRAINT IF EXISTS subjects_credits_check;

ALTER TABLE subjects
ADD CONSTRAINT subjects_credits_check
CHECK (credits >= 0 AND credits <= 10);

-- Note: This migration allows credits like 1.5, 2.5, 3.5, etc.
-- The NUMERIC(4, 2) type allows up to 2 decimal places (e.g., 1.50, 3.25)
