-- ============================================
-- Guided & Dynamic Scenario Sessions Tables
-- ============================================

-- Guided 시나리오 세션 테이블
CREATE TABLE IF NOT EXISTS guided_scenario_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL REFERENCES scenario_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL REFERENCES persona_core(id) ON DELETE CASCADE,

  -- 진행 상태
  current_plot_index INTEGER DEFAULT 0,
  current_exchange_count INTEGER DEFAULT 0,
  session_state TEXT DEFAULT 'active' CHECK (session_state IN ('active', 'paused', 'completed', 'abandoned')),

  -- 플롯 진행 정보 (JSON array)
  plot_progress JSONB DEFAULT '[]',

  -- 컨텍스트
  context JSONB DEFAULT '{"affection": 0, "relationshipStage": "stranger", "sessionMemory": []}',

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 인덱스용 필드
  CONSTRAINT unique_active_guided_session UNIQUE (user_id, persona_id, session_state)
);

-- Dynamic 시나리오 세션 테이블
CREATE TABLE IF NOT EXISTS dynamic_scenario_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL REFERENCES dynamic_scenario_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL REFERENCES persona_core(id) ON DELETE CASCADE,

  -- 진행 상태
  turn_count INTEGER DEFAULT 0,
  session_state TEXT DEFAULT 'active' CHECK (session_state IN ('active', 'paused', 'completed', 'abandoned')),

  -- 현재 내러티브 상태
  current_narrative JSONB DEFAULT '{"situation": "", "emotionalTone": "", "storyDirection": ""}',

  -- 대화 기록
  conversation_history JSONB DEFAULT '[]',

  -- 컨텍스트
  context JSONB DEFAULT '{"affection": 0, "relationshipStage": "stranger", "triggeredBy": "", "sessionMemory": []}',

  -- 가드레일 위반 카운트
  guardrail_violations INTEGER DEFAULT 0,

  -- 완료 정보
  completion_reason TEXT,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- 인덱스용 필드
  CONSTRAINT unique_active_dynamic_session UNIQUE (user_id, persona_id, session_state)
);

-- 시나리오 완료 보상 테이블
CREATE TABLE IF NOT EXISTS scenario_completion_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL REFERENCES persona_core(id) ON DELETE CASCADE,
  scenario_session_id TEXT NOT NULL,
  scenario_mode TEXT NOT NULL CHECK (scenario_mode IN ('static', 'guided', 'dynamic')),

  -- 보상 정보
  affection_earned INTEGER DEFAULT 0,
  coins_earned INTEGER DEFAULT 0,
  special_rewards JSONB DEFAULT '[]',

  -- 타임스탬프
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스
-- ============================================

CREATE INDEX IF NOT EXISTS idx_guided_sessions_user_persona
  ON guided_scenario_sessions(user_id, persona_id);

CREATE INDEX IF NOT EXISTS idx_guided_sessions_state
  ON guided_scenario_sessions(session_state);

CREATE INDEX IF NOT EXISTS idx_guided_sessions_scenario
  ON guided_scenario_sessions(scenario_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_user_persona
  ON dynamic_scenario_sessions(user_id, persona_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_state
  ON dynamic_scenario_sessions(session_state);

CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_template
  ON dynamic_scenario_sessions(template_id);

CREATE INDEX IF NOT EXISTS idx_completion_rewards_user
  ON scenario_completion_rewards(user_id);

CREATE INDEX IF NOT EXISTS idx_completion_rewards_persona
  ON scenario_completion_rewards(persona_id);

-- ============================================
-- RLS 정책
-- ============================================

ALTER TABLE guided_scenario_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_scenario_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_completion_rewards ENABLE ROW LEVEL SECURITY;

-- Guided 세션 정책
CREATE POLICY "Users can view their own guided sessions"
  ON guided_scenario_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create guided sessions"
  ON guided_scenario_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own guided sessions"
  ON guided_scenario_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Dynamic 세션 정책
CREATE POLICY "Users can view their own dynamic sessions"
  ON dynamic_scenario_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create dynamic sessions"
  ON dynamic_scenario_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dynamic sessions"
  ON dynamic_scenario_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- 완료 보상 정책
CREATE POLICY "Users can view their own completion rewards"
  ON scenario_completion_rewards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create completion rewards"
  ON scenario_completion_rewards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 서비스 롤 정책 (백엔드용)
CREATE POLICY "Service role full access to guided sessions"
  ON guided_scenario_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to dynamic sessions"
  ON dynamic_scenario_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to completion rewards"
  ON scenario_completion_rewards FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 유니크 제약 조건 수정 (활성 세션만 체크)
-- ============================================

-- 기존 제약 조건 삭제 후 부분 인덱스로 대체
ALTER TABLE guided_scenario_sessions DROP CONSTRAINT IF EXISTS unique_active_guided_session;
ALTER TABLE dynamic_scenario_sessions DROP CONSTRAINT IF EXISTS unique_active_dynamic_session;

-- 활성 세션에만 적용되는 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_guided_session_idx
  ON guided_scenario_sessions(user_id, persona_id)
  WHERE session_state = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_dynamic_session_idx
  ON dynamic_scenario_sessions(user_id, persona_id)
  WHERE session_state = 'active';
