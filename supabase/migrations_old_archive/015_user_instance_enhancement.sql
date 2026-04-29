-- ============================================
-- User Instance 테이블 보강
-- 유저별 페르소나 진화 데이터
-- ============================================

-- 1. user_persona_relationships 테이블 확인 및 생성
-- (이미 존재할 수 있으므로 IF NOT EXISTS 사용)
CREATE TABLE IF NOT EXISTS user_persona_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,

  -- 관계 상태
  affection INTEGER DEFAULT 0 CHECK (affection >= 0 AND affection <= 100),
  relationship_stage TEXT DEFAULT 'stranger' CHECK (relationship_stage IN (
    'stranger', 'acquaintance', 'friend', 'close', 'intimate', 'lover'
  )),

  -- 신뢰/친밀도
  trust_level INTEGER DEFAULT 0,
  intimacy_level INTEGER DEFAULT 0,
  tension_level INTEGER DEFAULT 0,

  -- 스토리 진행
  completed_episodes TEXT[] DEFAULT '{}',
  unlocked_episodes TEXT[] DEFAULT '{}',
  story_flags JSONB DEFAULT '{}'::jsonb,

  -- 통계
  total_messages INTEGER DEFAULT 0,
  total_scenarios_completed INTEGER DEFAULT 0,
  first_interaction_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  longest_conversation_length INTEGER DEFAULT 0,

  -- 특별 관계 데이터
  shared_secrets_count INTEGER DEFAULT 0,
  conflicts_resolved INTEGER DEFAULT 0,
  user_nickname TEXT,      -- 페르소나가 유저를 부르는 별명
  persona_nickname TEXT,   -- 유저가 페르소나를 부르는 별명

  -- 해금 상태
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, persona_id)
);

-- 2. 관계 마일스톤 테이블
CREATE TABLE IF NOT EXISTS relationship_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,

  -- 마일스톤 타입
  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'first_meeting',          -- 첫 만남
    'first_dm',               -- 첫 DM
    'first_scenario',         -- 첫 시나리오 완료
    'affection_25',           -- 호감도 25 달성
    'affection_50',           -- 호감도 50 달성
    'affection_75',           -- 호감도 75 달성
    'affection_100',          -- 호감도 100 달성
    'stage_acquaintance',     -- 아는 사이 됨
    'stage_friend',           -- 친구 됨
    'stage_close',            -- 가까운 사이 됨
    'stage_intimate',         -- 친밀한 사이 됨
    'stage_lover',            -- 연인 됨
    'first_conflict',         -- 첫 갈등
    'first_reconciliation',   -- 첫 화해
    'first_secret_shared',    -- 첫 비밀 공유
    'anniversary_7days',      -- 7일 기념
    'anniversary_30days',     -- 30일 기념
    'anniversary_100days',    -- 100일 기념
    'messages_100',           -- 100개 메시지
    'messages_500',           -- 500개 메시지
    'messages_1000'           -- 1000개 메시지
  )),

  -- 마일스톤 달성 시점 상태
  affection_at_time INTEGER,
  relationship_stage_at_time TEXT,

  -- 추가 데이터
  context JSONB DEFAULT '{}'::jsonb,

  achieved_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, persona_id, milestone_type)
);

-- 3. 유저 여정 통계
CREATE TABLE IF NOT EXISTS user_journey_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,

  -- 대화 통계
  total_dm_sessions INTEGER DEFAULT 0,
  total_dm_messages_sent INTEGER DEFAULT 0,
  total_dm_messages_received INTEGER DEFAULT 0,
  avg_session_length_minutes FLOAT DEFAULT 0,
  longest_session_minutes INTEGER DEFAULT 0,

  -- 시나리오 통계
  total_scenarios_started INTEGER DEFAULT 0,
  total_scenarios_completed INTEGER DEFAULT 0,
  total_scenarios_abandoned INTEGER DEFAULT 0,
  total_choices_made INTEGER DEFAULT 0,
  premium_choices_made INTEGER DEFAULT 0,

  -- 호감도 변화 통계
  total_affection_gained INTEGER DEFAULT 0,
  total_affection_lost INTEGER DEFAULT 0,
  max_affection_reached INTEGER DEFAULT 0,
  affection_changes_count INTEGER DEFAULT 0,

  -- 시간 통계
  total_time_spent_minutes INTEGER DEFAULT 0,
  days_active INTEGER DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  max_streak_days INTEGER DEFAULT 0,
  last_active_date DATE,

  -- 이벤트 통계
  events_triggered INTEGER DEFAULT 0,
  events_responded INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, persona_id)
);

-- 4. persona_memories 테이블에 추가 필드
ALTER TABLE persona_memories ADD COLUMN IF NOT EXISTS
  importance_score INTEGER DEFAULT 5 CHECK (importance_score >= 1 AND importance_score <= 10);
ALTER TABLE persona_memories ADD COLUMN IF NOT EXISTS
  is_active BOOLEAN DEFAULT true;
ALTER TABLE persona_memories ADD COLUMN IF NOT EXISTS
  expires_at TIMESTAMPTZ;
ALTER TABLE persona_memories ADD COLUMN IF NOT EXISTS
  source_type TEXT DEFAULT 'dm' CHECK (source_type IN ('dm', 'scenario', 'event', 'system'));
ALTER TABLE persona_memories ADD COLUMN IF NOT EXISTS
  source_id TEXT;

-- 5. 뷰: 유저-페르소나 전체 상태
CREATE OR REPLACE VIEW user_persona_full_state AS
SELECT
  upr.user_id,
  upr.persona_id,
  upr.affection,
  upr.relationship_stage,
  upr.trust_level,
  upr.intimacy_level,
  upr.is_unlocked,
  upr.total_messages,
  upr.first_interaction_at,
  upr.last_interaction_at,
  upr.user_nickname,
  upr.persona_nickname,
  upr.story_flags,
  ujs.total_dm_sessions,
  ujs.total_scenarios_completed,
  ujs.current_streak_days,
  ujs.max_streak_days,
  ujs.total_time_spent_minutes,
  ues.last_dm_event_at,
  ues.events_today,
  ues.consecutive_days_active,
  (SELECT COUNT(*) FROM persona_memories pm WHERE pm.user_id = upr.user_id AND pm.persona_id = upr.persona_id AND pm.is_active = true) as active_memories_count,
  (SELECT COUNT(*) FROM relationship_milestones rm WHERE rm.user_id = upr.user_id AND rm.persona_id = upr.persona_id) as milestones_achieved
FROM user_persona_relationships upr
LEFT JOIN user_journey_stats ujs ON upr.user_id = ujs.user_id AND upr.persona_id = ujs.persona_id
LEFT JOIN user_event_state ues ON upr.user_id = ues.user_id AND upr.persona_id = ues.persona_id;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_persona_relationships_user ON user_persona_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_persona_relationships_persona ON user_persona_relationships(persona_id);
CREATE INDEX IF NOT EXISTS idx_user_persona_relationships_stage ON user_persona_relationships(relationship_stage);
CREATE INDEX IF NOT EXISTS idx_user_persona_relationships_unlocked ON user_persona_relationships(is_unlocked);

CREATE INDEX IF NOT EXISTS idx_relationship_milestones_user_persona ON relationship_milestones(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_relationship_milestones_type ON relationship_milestones(milestone_type);

CREATE INDEX IF NOT EXISTS idx_user_journey_stats_user_persona ON user_journey_stats(user_id, persona_id);

CREATE INDEX IF NOT EXISTS idx_persona_memories_active ON persona_memories(is_active);
CREATE INDEX IF NOT EXISTS idx_persona_memories_importance ON persona_memories(importance_score);

-- ============================================
-- 트리거: 자동 마일스톤 기록
-- ============================================

CREATE OR REPLACE FUNCTION check_and_record_milestones()
RETURNS TRIGGER AS $$
BEGIN
  -- 호감도 마일스톤 체크
  IF NEW.affection >= 25 AND (OLD.affection IS NULL OR OLD.affection < 25) THEN
    INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'affection_25', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  IF NEW.affection >= 50 AND (OLD.affection IS NULL OR OLD.affection < 50) THEN
    INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'affection_50', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  IF NEW.affection >= 75 AND (OLD.affection IS NULL OR OLD.affection < 75) THEN
    INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'affection_75', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  IF NEW.affection >= 100 AND (OLD.affection IS NULL OR OLD.affection < 100) THEN
    INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'affection_100', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  -- 관계 단계 마일스톤 체크
  IF NEW.relationship_stage != OLD.relationship_stage THEN
    IF NEW.relationship_stage = 'acquaintance' THEN
      INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
      VALUES (NEW.user_id, NEW.persona_id, 'stage_acquaintance', NEW.affection, NEW.relationship_stage)
      ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
    ELSIF NEW.relationship_stage = 'friend' THEN
      INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
      VALUES (NEW.user_id, NEW.persona_id, 'stage_friend', NEW.affection, NEW.relationship_stage)
      ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
    ELSIF NEW.relationship_stage = 'close' THEN
      INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
      VALUES (NEW.user_id, NEW.persona_id, 'stage_close', NEW.affection, NEW.relationship_stage)
      ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
    ELSIF NEW.relationship_stage = 'intimate' THEN
      INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
      VALUES (NEW.user_id, NEW.persona_id, 'stage_intimate', NEW.affection, NEW.relationship_stage)
      ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
    ELSIF NEW.relationship_stage = 'lover' THEN
      INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
      VALUES (NEW.user_id, NEW.persona_id, 'stage_lover', NEW.affection, NEW.relationship_stage)
      ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
    END IF;
  END IF;

  -- 메시지 수 마일스톤 체크
  IF NEW.total_messages >= 100 AND (OLD.total_messages IS NULL OR OLD.total_messages < 100) THEN
    INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'messages_100', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  IF NEW.total_messages >= 500 AND (OLD.total_messages IS NULL OR OLD.total_messages < 500) THEN
    INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'messages_500', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  IF NEW.total_messages >= 1000 AND (OLD.total_messages IS NULL OR OLD.total_messages < 1000) THEN
    INSERT INTO relationship_milestones (user_id, persona_id, milestone_type, affection_at_time, relationship_stage_at_time)
    VALUES (NEW.user_id, NEW.persona_id, 'messages_1000', NEW.affection, NEW.relationship_stage)
    ON CONFLICT (user_id, persona_id, milestone_type) DO NOTHING;
  END IF;

  -- updated_at 갱신
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 존재하면 삭제 후 재생성)
DROP TRIGGER IF EXISTS trigger_check_milestones ON user_persona_relationships;
CREATE TRIGGER trigger_check_milestones
  BEFORE UPDATE ON user_persona_relationships
  FOR EACH ROW
  EXECUTE FUNCTION check_and_record_milestones();
