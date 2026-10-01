-- ============================================================
-- EduGrade - Supabase PostgreSQL Schema
-- Student Academic Management System with RLS
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- Stores user profile information
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- SEMESTERS TABLE
-- Stores semester information (1-1, 1-2, 2-1, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS semesters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- e.g., "1-1", "2-2"
  year INTEGER NOT NULL CHECK (year >= 1 AND year <= 4),
  semester_number INTEGER NOT NULL CHECK (semester_number IN (1, 2)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year, semester_number)
);

-- Indexes for performance
CREATE INDEX idx_semesters_user_id ON semesters(user_id);
CREATE INDEX idx_semesters_year_sem ON semesters(year, semester_number);

-- RLS Policies for semesters
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own semesters"
  ON semesters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own semesters"
  ON semesters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own semesters"
  ON semesters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own semesters"
  ON semesters FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- SUBJECTS TABLE
-- Stores subject/course information with grades
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits >= 0 AND credits <= 10),
  grade TEXT CHECK (grade IN ('S', 'A', 'B', 'C', 'D', 'E', 'F', 'Completed')),
  grade_points INTEGER CHECK (grade_points >= 0 AND grade_points <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_subjects_semester_id ON subjects(semester_id);
CREATE INDEX idx_subjects_user_id ON subjects(user_id);

-- RLS Policies for subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subjects"
  ON subjects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subjects"
  ON subjects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subjects"
  ON subjects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subjects"
  ON subjects FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- ATTENDANCE TABLE
-- Tracks attendance for each subject
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classes_attended INTEGER DEFAULT 0 CHECK (classes_attended >= 0),
  total_classes INTEGER DEFAULT 0 CHECK (total_classes >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id)
);

-- Indexes for performance
CREATE INDEX idx_attendance_subject_id ON attendance(subject_id);
CREATE INDEX idx_attendance_user_id ON attendance(user_id);

-- RLS Policies for attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendance"
  ON attendance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
  ON attendance FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own attendance"
  ON attendance FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- TARGETS TABLE
-- Stores CGPA target goals for students
-- ============================================================
CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_cgpa DECIMAL(3, 2) NOT NULL CHECK (target_cgpa >= 0 AND target_cgpa <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_targets_user_id ON targets(user_id);

-- RLS Policies for targets
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own targets"
  ON targets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own targets"
  ON targets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own targets"
  ON targets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own targets"
  ON targets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_semesters_updated_at
  BEFORE UPDATE ON semesters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_targets_updated_at
  BEFORE UPDATE ON targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: Create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
