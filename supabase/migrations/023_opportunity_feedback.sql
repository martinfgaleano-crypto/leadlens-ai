-- 023_opportunity_feedback.sql
-- Per-opportunity feedback from users — learning signals for future Vault integration.
-- No personal data: no emails, no phone numbers, no individual contact names.
-- Only company-level and signal-level data.

CREATE TABLE IF NOT EXISTS opportunity_feedback (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to run context (both nullable — feedback works in demo mode too)
  user_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id             TEXT,
  search_id          UUID        REFERENCES lead_searches(id) ON DELETE SET NULL,

  -- Company identity (public info only — no personal contacts)
  company            TEXT        NOT NULL,
  domain             TEXT,

  -- Segment / scoring context
  industry           TEXT,
  segment            TEXT,
  opportunity_score  NUMERIC     CHECK (opportunity_score BETWEEN 0 AND 10),
  category           TEXT        CHECK (category IN ('HOT','WARM','COLD','DISCARD')),
  recommended_action TEXT,
  signal_patterns    JSONB,      -- string[] of confirmed timing signals
  buying_window      TEXT,

  -- Feedback
  feedback_signal    TEXT        NOT NULL,  -- FeedbackSignal enum value
  feedback_notes     TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS opp_fb_job_id_idx    ON opportunity_feedback (job_id)          WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS opp_fb_company_idx   ON opportunity_feedback (company);
CREATE INDEX IF NOT EXISTS opp_fb_signal_idx    ON opportunity_feedback (feedback_signal);
CREATE INDEX IF NOT EXISTS opp_fb_industry_idx  ON opportunity_feedback (industry)         WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS opp_fb_created_idx   ON opportunity_feedback (created_at DESC);

ALTER TABLE opportunity_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT feedback (with or without user_id)
DROP POLICY IF EXISTS "opp_fb_insert" ON opportunity_feedback;
CREATE POLICY "opp_fb_insert"
  ON opportunity_feedback FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Authenticated users can SELECT their own feedback rows
DROP POLICY IF EXISTS "opp_fb_select_own" ON opportunity_feedback;
CREATE POLICY "opp_fb_select_own"
  ON opportunity_feedback FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- Service role (admin) can read all for analytics
-- (service role bypasses RLS automatically — no policy needed)
