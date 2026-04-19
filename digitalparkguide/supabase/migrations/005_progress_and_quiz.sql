-- B2.3: Guide module progress tracking
CREATE TABLE IF NOT EXISTS guide_module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  assets_consumed UUID[] DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guide_id, module_id)
);
ALTER TABLE guide_module_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guides_own_progress" ON guide_module_progress
  FOR ALL USING (auth.uid() = guide_id);

-- B2.4: Badge eligibility on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badge_eligible_tracks UUID[] DEFAULT '{}';

-- B3.1: Fix quizzes table with module FK and configurable fields
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES training_modules(id);
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 3;
-- passing_score should already exist, ensure it has a default
ALTER TABLE quizzes ALTER COLUMN passing_score SET DEFAULT 80;

-- B3.4: Track attempt number and time taken
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS attempt_number INT DEFAULT 1;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS time_taken_seconds INT;
