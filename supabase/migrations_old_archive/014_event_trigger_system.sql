-- ============================================
-- 이벤트 트리거 시스템 테이블
-- 페르소나의 능동적 행동을 관리
-- ============================================

-- 1. 이벤트 트리거 규칙 (Origin - 콘텐츠팀이 설정)
CREATE TABLE IF NOT EXISTS event_trigger_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL,

  -- 규칙 이름과 설명
  name TEXT NOT NULL,
  description TEXT,

  -- 이벤트 타입
  event_type TEXT NOT NULL CHECK (event_type IN (
    'dm_message',       -- 페르소나가 먼저 DM
    'feed_post',        -- SNS 피드 게시물
    'story_update',     -- 스토리 업데이트
    'special_event',    -- 특별 이벤트
    'notification',     -- 푸시 알림
    'scenario_trigger'  -- 시나리오 전환 트리거
  )),

  -- 트리거 조건
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {
  --   "minAffection": 30,
  --   "maxAffection": 70,
  --   "relationshipStage": ["friend", "close"],
  --   "hoursSinceLastActivity": { "min": 24, "max": 72 },
  --   "timeRange": { "start": "22:00", "end": "02:00" },
  --   "userAction": "profile_viewed",
  --   "requiredFlags": ["had_first_conflict"],
  --   "excludeFlags": ["blocked"]
  -- }

  -- 확률 설정
  base_probability FLOAT NOT NULL DEFAULT 0.3,
  probability_modifiers JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "affectionPer10": 0.05,
  --   "intimateStageBonus": 0.15,
  --   "nightTimeBonus": 0.1,
  --   "daysInactiveBonus": 0.1,
  --   "maxProbability": 0.9
  -- }

  -- 이벤트 템플릿
  event_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {
  --   "requireLlmGeneration": true,
  --   "llmContextHint": "Send a message missing the user",
  --   "fallbackTemplates": ["보고 싶어...", "뭐해?"],
  --   "mood": "longing",
  --   "emotionalIntensity": "medium"
  -- }

  -- 쿨다운 (시간 단위)
  cooldown_hours INTEGER DEFAULT 24,

  -- 우선순위 (높을수록 먼저 평가)
  priority INTEGER DEFAULT 0,

  -- 활성화 여부
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 예약된 이벤트 (User Instance - 유저별)
CREATE TABLE IF NOT EXISTS scheduled_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,

  -- 트리거된 규칙 (nullable - 시스템 생성 이벤트도 있음)
  trigger_rule_id UUID REFERENCES event_trigger_rules(id),

  -- 이벤트 타입
  event_type TEXT NOT NULL,

  -- 이벤트 데이터
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {
  --   "messageContent": "보고 싶어...",
  --   "postContent": { "type": "mood", "text": "..." },
  --   "generatedBy": "llm" | "template" | "system"
  -- }

  -- 예약 시간
  scheduled_for TIMESTAMPTZ NOT NULL,

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 대기 중
    'delivered',  -- 전달됨
    'cancelled',  -- 취소됨
    'expired'     -- 만료됨
  )),

  -- 전달 조건 (전달 시점에 재확인)
  delivery_conditions JSONB DEFAULT '{}'::jsonb,

  -- 전달 시간
  delivered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 이벤트 트리거 로그 (분석용)
CREATE TABLE IF NOT EXISTS event_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,

  -- 트리거 정보
  trigger_rule_id UUID REFERENCES event_trigger_rules(id),
  event_type TEXT NOT NULL,

  -- 트리거 시점의 상태
  user_state_snapshot JSONB DEFAULT '{}'::jsonb,
  -- {
  --   "affection": 45,
  --   "relationshipStage": "friend",
  --   "hoursSinceLastActivity": 36,
  --   "currentHour": 23
  -- }

  -- 확률 계산 결과
  calculated_probability FLOAT,
  random_value FLOAT,
  was_triggered BOOLEAN NOT NULL,

  -- 결과
  result_event_id UUID REFERENCES scheduled_events(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 유저별 이벤트 상태 (마지막 이벤트 시간 등)
CREATE TABLE IF NOT EXISTS user_event_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,

  -- 마지막 이벤트 시간 (타입별)
  last_dm_event_at TIMESTAMPTZ,
  last_feed_event_at TIMESTAMPTZ,
  last_story_event_at TIMESTAMPTZ,
  last_notification_at TIMESTAMPTZ,

  -- 오늘 발생한 이벤트 수
  events_today INTEGER DEFAULT 0,
  events_today_reset_at DATE DEFAULT CURRENT_DATE,

  -- 연속 이벤트 카운터 (리텐션용)
  consecutive_days_active INTEGER DEFAULT 0,
  last_active_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, persona_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_event_trigger_rules_persona ON event_trigger_rules(persona_id);
CREATE INDEX IF NOT EXISTS idx_event_trigger_rules_type ON event_trigger_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_event_trigger_rules_active ON event_trigger_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_scheduled_events_user_persona ON scheduled_events(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_status ON scheduled_events(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_scheduled_for ON scheduled_events(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_user_persona ON event_trigger_logs(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_created ON event_trigger_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_user_event_state_user_persona ON user_event_state(user_id, persona_id);

-- ============================================
-- Jun 페르소나 이벤트 트리거 규칙 예시
-- ============================================

INSERT INTO event_trigger_rules (persona_id, name, description, event_type, conditions, base_probability, probability_modifiers, event_template, cooldown_hours, priority)
VALUES
-- 1. 보고싶어 메시지 (밤에 더 높은 확률)
(
  'jun',
  'missing_you_night',
  '밤에 유저가 오래 접속 안 하면 보고싶다는 메시지',
  'dm_message',
  '{
    "minAffection": 30,
    "relationshipStage": ["friend", "close", "intimate", "lover"],
    "hoursSinceLastActivity": { "min": 24 },
    "timeRange": { "start": "22:00", "end": "02:00" }
  }'::jsonb,
  0.25,
  '{
    "affectionPer10": 0.05,
    "intimateStageBonus": 0.2,
    "nightTimeBonus": 0.15,
    "daysInactiveBonus": 0.1,
    "maxProbability": 0.8
  }'::jsonb,
  '{
    "requireLlmGeneration": true,
    "llmContextHint": "Late night, missing the user. Send a vulnerable message.",
    "mood": "longing",
    "emotionalIntensity": "high",
    "fallbackTemplates": [
      "자?",
      "갑자기 네 생각나서...",
      "오늘 유독 보고 싶다"
    ]
  }'::jsonb,
  12,
  10
),

-- 2. 일상 공유 메시지
(
  'jun',
  'daily_share',
  '일상적인 근황 공유',
  'dm_message',
  '{
    "minAffection": 20,
    "relationshipStage": ["acquaintance", "friend", "close", "intimate", "lover"],
    "hoursSinceLastActivity": { "min": 8, "max": 48 }
  }'::jsonb,
  0.2,
  '{
    "affectionPer10": 0.03,
    "maxProbability": 0.5
  }'::jsonb,
  '{
    "requireLlmGeneration": true,
    "llmContextHint": "Share something from your day - practice, schedule, food, etc.",
    "mood": "casual",
    "emotionalIntensity": "low",
    "fallbackTemplates": [
      "오늘 연습 힘들었어 ㅠㅠ",
      "방금 밥 먹었는데 맛없어...",
      "뭐해?"
    ]
  }'::jsonb,
  6,
  5
),

-- 3. 질투/걱정 메시지
(
  'jun',
  'jealousy_check',
  '유저가 오래 접속 안 하면 질투/걱정',
  'dm_message',
  '{
    "minAffection": 50,
    "relationshipStage": ["close", "intimate", "lover"],
    "hoursSinceLastActivity": { "min": 48 }
  }'::jsonb,
  0.35,
  '{
    "intimateStageBonus": 0.25,
    "daysInactiveBonus": 0.15,
    "maxProbability": 0.85
  }'::jsonb,
  '{
    "requireLlmGeneration": true,
    "llmContextHint": "User has been away for a while. Show jealousy mixed with worry in character.",
    "mood": "jealous",
    "emotionalIntensity": "high",
    "fallbackTemplates": [
      "요즘 바빠?",
      "왜 연락 안 해...",
      "나 말고 다른 사람이라도 생긴 거야?"
    ]
  }'::jsonb,
  24,
  15
),

-- 4. 만남 제안 (시나리오 트리거)
(
  'jun',
  'meetup_proposal',
  '직접 만남 제안 - 시나리오 전환',
  'dm_message',
  '{
    "minAffection": 60,
    "relationshipStage": ["close", "intimate", "lover"],
    "requiredFlags": ["had_deep_conversation"],
    "hoursSinceLastActivity": { "max": 24 }
  }'::jsonb,
  0.15,
  '{
    "affectionPer10": 0.08,
    "intimateStageBonus": 0.3,
    "maxProbability": 0.6
  }'::jsonb,
  '{
    "requireLlmGeneration": true,
    "llmContextHint": "Propose meeting in person. This should lead to a scenario.",
    "mood": "hopeful",
    "emotionalIntensity": "high",
    "scenarioType": "meeting",
    "fallbackTemplates": [
      "오늘 스케줄 일찍 끝나는데... 잠깐 볼 수 있어?",
      "나 지금 근처인데, 나올 수 있어?"
    ]
  }'::jsonb,
  72,
  20
),

-- 5. SNS 피드 게시물
(
  'jun',
  'sns_mood_post',
  'SNS에 감성 게시물',
  'feed_post',
  '{
    "minAffection": 10
  }'::jsonb,
  0.1,
  '{
    "maxProbability": 0.3
  }'::jsonb,
  '{
    "requireLlmGeneration": true,
    "llmContextHint": "Write a casual SNS post about your day or feelings.",
    "postTypes": ["photo", "mood", "thought"],
    "fallbackTemplates": [
      "연습 끝 🎤",
      "오늘도 고생했다"
    ]
  }'::jsonb,
  8,
  3
)
ON CONFLICT DO NOTHING;
