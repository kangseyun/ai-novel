-- ===========================================
-- 020: Emotional State Tracking System
-- 감정 상태 지속성 및 갈등 추적 시스템
-- ===========================================

-- 감정 상태 테이블
-- 유저-페르소나 관계의 현재 감정 상태를 추적
CREATE TABLE IF NOT EXISTS emotional_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

  -- 현재 감정 상태
  mood VARCHAR(20) NOT NULL DEFAULT 'neutral',
  tension_level INTEGER NOT NULL DEFAULT 5 CHECK (tension_level >= 0 AND tension_level <= 10),
  warmth_level INTEGER NOT NULL DEFAULT 5 CHECK (warmth_level >= 0 AND warmth_level <= 10),

  -- 갈등 상태
  unresolved_conflict BOOLEAN NOT NULL DEFAULT false,
  conflict_context TEXT,

  -- 상호작용 추적
  last_positive_interaction TIMESTAMPTZ,
  last_negative_interaction TIMESTAMPTZ,
  consecutive_negative_count INTEGER NOT NULL DEFAULT 0,

  -- 최근 감정 이벤트 (JSONB 배열)
  recent_emotional_events JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 유니크 제약조건
  UNIQUE(user_id, persona_id)
);

-- 갈등 기록 테이블
-- 갈등 발생과 해결 이력을 추적
CREATE TABLE IF NOT EXISTS conflict_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

  -- 갈등 정보
  conflict_type VARCHAR(30) NOT NULL,
  severity INTEGER NOT NULL DEFAULT 5 CHECK (severity >= 1 AND severity <= 10),
  cause TEXT NOT NULL,
  persona_feeling VARCHAR(20) NOT NULL,

  -- 해결 상태
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_type VARCHAR(30),

  -- 쿨다운 및 영향
  cooldown_hours DECIMAL(5,2) NOT NULL DEFAULT 1,
  affection_impact INTEGER NOT NULL DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- 인덱스 생성
-- ===========================================

-- 감정 상태 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_emotional_states_user_persona
  ON emotional_states(user_id, persona_id);

CREATE INDEX IF NOT EXISTS idx_emotional_states_unresolved
  ON emotional_states(user_id, persona_id)
  WHERE unresolved_conflict = true;

-- 갈등 기록 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_conflict_records_user_persona
  ON conflict_records(user_id, persona_id);

CREATE INDEX IF NOT EXISTS idx_conflict_records_unresolved
  ON conflict_records(user_id, persona_id, is_resolved)
  WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_conflict_records_created
  ON conflict_records(created_at DESC);

-- ===========================================
-- RLS 정책
-- ===========================================

ALTER TABLE emotional_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_records ENABLE ROW LEVEL SECURITY;

-- 감정 상태 정책
CREATE POLICY "Users can view own emotional states"
  ON emotional_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emotional states"
  ON emotional_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emotional states"
  ON emotional_states FOR UPDATE
  USING (auth.uid() = user_id);

-- 갈등 기록 정책
CREATE POLICY "Users can view own conflict records"
  ON conflict_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conflict records"
  ON conflict_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conflict records"
  ON conflict_records FOR UPDATE
  USING (auth.uid() = user_id);

-- ===========================================
-- 트리거: updated_at 자동 갱신
-- ===========================================

CREATE OR REPLACE FUNCTION update_emotional_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_emotional_state_timestamp
  BEFORE UPDATE ON emotional_states
  FOR EACH ROW
  EXECUTE FUNCTION update_emotional_state_timestamp();

-- ===========================================
-- 헬퍼 함수: 갈등 쿨다운 체크
-- ===========================================

CREATE OR REPLACE FUNCTION check_conflict_cooldown(
  p_user_id UUID,
  p_persona_id UUID
)
RETURNS TABLE (
  conflict_id UUID,
  conflict_type VARCHAR(30),
  hours_remaining DECIMAL(5,2),
  is_cooling_down BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id,
    cr.conflict_type,
    GREATEST(0, cr.cooldown_hours - EXTRACT(EPOCH FROM (NOW() - cr.created_at)) / 3600)::DECIMAL(5,2) as hours_remaining,
    (cr.cooldown_hours > EXTRACT(EPOCH FROM (NOW() - cr.created_at)) / 3600) as is_cooling_down
  FROM conflict_records cr
  WHERE cr.user_id = p_user_id
    AND cr.persona_id = p_persona_id
    AND cr.is_resolved = false;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 코멘트
-- ===========================================

COMMENT ON TABLE emotional_states IS '유저-페르소나 관계의 감정 상태를 추적하는 테이블';
COMMENT ON TABLE conflict_records IS '갈등 발생 및 해결 이력을 추적하는 테이블';
COMMENT ON COLUMN emotional_states.recent_emotional_events IS '최근 감정 이벤트 배열 (최대 10개)';
COMMENT ON COLUMN conflict_records.cooldown_hours IS '페르소나가 마음을 풀기까지 필요한 시간';
