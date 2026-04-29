-- ============================================
-- 시나리오 시스템 V2
-- Static / Guided / Dynamic 시나리오 지원
-- Event Trigger 시스템과 연동
-- ============================================

-- 1. scenario_templates에 generation_mode 필드 추가
ALTER TABLE scenario_templates ADD COLUMN IF NOT EXISTS
  generation_mode TEXT DEFAULT 'static' CHECK (generation_mode IN (
    'static',    -- 기존 방식 (모든 씬 사전 정의)
    'guided',    -- 플롯 포인트 + AI 생성
    'dynamic'    -- 완전 동적 생성
  ));

-- 2. event_trigger_rules에 시나리오 연동 필드 추가
ALTER TABLE event_trigger_rules ADD COLUMN IF NOT EXISTS
  action_type TEXT DEFAULT 'dm_message' CHECK (action_type IN (
    'dm_message',          -- 기존: DM 메시지 전송
    'feed_post',           -- 기존: 피드 게시
    'start_scenario',      -- 시나리오 시작
    'unlock_content',      -- 콘텐츠 해금
    'grant_reward',        -- 보상 지급
    'update_relationship'  -- 관계 상태 업데이트
  ));

ALTER TABLE event_trigger_rules ADD COLUMN IF NOT EXISTS
  scenario_config JSONB DEFAULT NULL;
  -- start_scenario 액션인 경우:
  -- {
  --   "scenario_type": "static" | "guided" | "dynamic",
  --   "scenario_id": "xxx" (static/guided인 경우),
  --   "dynamic_template_id": "xxx" (dynamic인 경우),
  --   "interrupt_dm": true (DM 중단하고 시나리오 시작)
  -- }

-- 3. Guided 시나리오 플롯 구조 테이블
CREATE TABLE IF NOT EXISTS guided_scenario_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL REFERENCES scenario_templates(id) ON DELETE CASCADE,

  -- 플롯 포인트 배열
  plot_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  /*
    [
      {
        "id": "intro",
        "type": "exposition",      -- exposition, rising_action, climax, falling_action, resolution
        "goal": "캐릭터가 우연히 마주치는 상황 설정",
        "required_elements": ["장소 묘사", "캐릭터 등장"],
        "mood": "mysterious",
        "min_exchanges": 2,
        "max_exchanges": 4,
        "choice_point": false
      },
      {
        "id": "choice_1",
        "type": "rising_action",
        "goal": "긴장감 형성, 유저의 선택",
        "choice_point": true,
        "choices": [
          { "id": "curious", "direction": "호기심 표현", "affection": 5, "next_plot": "positive_path" },
          { "id": "cautious", "direction": "경계심 표현", "affection": -2, "next_plot": "cautious_path" }
        ],
        "premium_choice": {
          "id": "bold",
          "direction": "대담하게 접근",
          "affection": 10,
          "next_plot": "bold_path"
        }
      }
    ]
  */

  -- AI 생성 규칙
  generation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    {
      "tone": "romantic_tension",
      "pacing": "slow_burn",         -- slow_burn, moderate, fast
      "dialogue_style": "natural_korean",
      "forbidden_topics": ["과도한 신체 접촉", "폭력"],
      "required_callbacks": ["이전 대화 참조", "캐릭터 특성 반영"],
      "max_message_length": 200,
      "include_inner_thoughts": true,
      "narration_style": "third_person"
    }
  */

  -- 캐릭터 행동 가이드라인
  character_guidelines JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "emotional_range": ["shy", "teasing", "curious"],
      "speech_patterns_override": null,
      "relationship_stage_behavior": "interest",
      "special_behaviors": ["occasional_stuttering", "avoid_eye_contact"]
    }
  */

  -- 시나리오 컨텍스트
  scenario_context JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "setting": "late_night_convenience_store",
      "time_of_day": "3am",
      "weather": "light_rain",
      "background_events": ["soft_music_playing"]
    }
  */

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id)
);

-- 4. Dynamic 시나리오 템플릿 테이블
CREATE TABLE IF NOT EXISTS dynamic_scenario_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL REFERENCES persona_core(id),

  name TEXT NOT NULL,
  description TEXT,

  -- 시나리오 카테고리
  scenario_category TEXT NOT NULL CHECK (scenario_category IN (
    'daily_event',       -- 일상 이벤트 (식사, 취미 등)
    'emotional_moment',  -- 감정적 순간 (위로, 축하 등)
    'special_date',      -- 특별한 날 (생일, 기념일)
    'conflict',          -- 갈등 상황
    'intimacy',          -- 친밀감 증가 순간
    'surprise',          -- 깜짝 이벤트
    'callback',          -- 과거 대화 참조 이벤트
    'milestone'          -- 관계 마일스톤
  )),

  -- AI 시스템 프롬프트 템플릿
  system_prompt_template TEXT NOT NULL,
  /*
    "당신은 {persona_name}입니다.
     현재 {user_name}과의 관계는 {relationship_stage} 단계입니다.
     호감도는 {affection_level}입니다.

     다음 상황에서 자연스러운 대화를 이어가세요:
     - 상황: {scenario_context}
     - 목표: {scenario_goal}
     - 이전 대화 요약: {conversation_summary}

     규칙:
     - {character_guidelines}
     - 메시지는 2-3문장으로 간결하게
     - 자연스러운 한국어 구어체 사용"
  */

  -- 컨텍스트 변수 목록
  context_variables TEXT[] DEFAULT ARRAY[
    'persona_name', 'user_name', 'relationship_stage',
    'affection_level', 'conversation_summary', 'time_of_day',
    'scenario_context', 'scenario_goal', 'character_guidelines'
  ],

  -- 시나리오 목표 (AI가 달성해야 할 것들)
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  /*
    [
      { "id": "engagement", "description": "유저와 자연스러운 대화 3회 이상" },
      { "id": "emotion", "description": "감정적 교류 1회 이상" },
      { "id": "hook", "description": "다음 대화 약속 유도", "optional": true }
    ]
  */

  -- 종료 조건
  end_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    {
      "max_exchanges": 10,
      "goal_achieved": true,
      "user_disengaged": { "no_response_count": 2 },
      "natural_ending_detected": true,
      "time_limit_minutes": 30
    }
  */

  -- 품질 게이트
  quality_gates JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "blocked_topics": ["정치", "종교", "성적 콘텐츠"],
      "blocked_words": [],
      "min_character_consistency": 0.8,
      "max_response_length": 300,
      "fallback_responses": [
        "흠... 잠깐 딴 생각했어. 뭐라고 했어?",
        "아, 미안. 다시 한번 말해줄래?"
      ]
    }
  */

  -- 연결된 트리거 (어떤 조건에서 이 동적 시나리오가 발동되는지)
  trigger_rule_id UUID REFERENCES event_trigger_rules(id),

  -- 활성화 상태
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Guided 시나리오 세션 (진행 상태 추적)
CREATE TABLE IF NOT EXISTS guided_scenario_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL REFERENCES scenario_templates(id),
  guided_plot_id UUID NOT NULL REFERENCES guided_scenario_plots(id),

  -- 현재 상태
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'abandoned', 'paused'
  )),

  -- 현재 플롯 포인트
  current_plot_point_id TEXT NOT NULL,
  current_plot_point_index INTEGER DEFAULT 0,

  -- 플롯 포인트별 진행 상황
  plot_progress JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "intro": { "status": "completed", "exchanges": 3 },
      "choice_1": { "status": "completed", "choice_made": "curious" },
      "positive_path": { "status": "in_progress", "exchanges": 1 }
    }
  */

  -- 현재 플롯 포인트 내 교환 횟수
  current_exchanges INTEGER DEFAULT 0,

  -- AI 생성된 대화 히스토리
  conversation_history JSONB DEFAULT '[]'::jsonb,
  /*
    [
      { "role": "ai", "content": "...", "timestamp": "...", "plot_point": "intro" },
      { "role": "user", "content": "...", "timestamp": "..." }
    ]
  */

  -- 선택 히스토리
  choices_made JSONB DEFAULT '[]'::jsonb,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(user_id, scenario_id, guided_plot_id)
);

-- 6. Dynamic 시나리오 세션
CREATE TABLE IF NOT EXISTS dynamic_scenario_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES dynamic_scenario_templates(id),
  persona_id TEXT NOT NULL,

  -- 상태
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'abandoned', 'failed'
  )),

  -- 트리거 컨텍스트 (발동 시점의 상태)
  trigger_context JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "affection": 55,
      "relationship_stage": "interest",
      "trigger_reason": "affection_threshold",
      "time_of_day": "evening"
    }
  */

  -- 목표 달성 상태
  goals_achieved JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "engagement": { "achieved": true, "count": 4 },
      "emotion": { "achieved": false },
      "hook": { "achieved": true }
    }
  */

  -- 대화 히스토리
  conversation_history JSONB DEFAULT '[]'::jsonb,

  -- 품질 통계
  quality_stats JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "total_messages": 5,
      "avg_response_length": 80,
      "blocked_attempts": 0,
      "fallback_used": 0,
      "character_consistency_scores": [0.9, 0.85, 0.92]
    }
  */

  -- 교환 횟수
  exchange_count INTEGER DEFAULT 0,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  end_reason TEXT  -- 'goal_achieved', 'max_exchanges', 'user_disengaged', 'natural_ending', 'failed'
);

-- 7. AI 시나리오 생성 요청 로그
CREATE TABLE IF NOT EXISTS scenario_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 요청자 (어드민 ID)
  requested_by UUID NOT NULL REFERENCES users(id),

  -- 생성 대상 페르소나
  persona_id TEXT NOT NULL REFERENCES persona_core(id),

  -- 생성 모드
  generation_mode TEXT NOT NULL CHECK (generation_mode IN ('static', 'guided', 'dynamic')),

  -- 요청 파라미터
  request_params JSONB NOT NULL,
  /*
    {
      "title": "첫 만남",
      "description": "편의점에서의 우연한 만남",
      "target_relationship_stage": "stranger",
      "plot_outline": "첫 만남 → 오해 → 화해 → 연락처 교환",
      "scene_count": 8,
      "choice_points": 2,
      "mood": ["mysterious", "romantic"]
    }
  */

  -- 생성된 결과
  generated_content JSONB,

  -- 최종 저장된 시나리오 ID
  result_scenario_id TEXT REFERENCES scenario_templates(id),

  -- 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'review', 'published', 'failed', 'cancelled'
  )),

  -- 리뷰/수정 히스토리
  revision_history JSONB DEFAULT '[]'::jsonb,
  /*
    [
      { "action": "generated", "timestamp": "...", "version": 1 },
      { "action": "edited", "timestamp": "...", "version": 2, "changes": {...} },
      { "action": "published", "timestamp": "...", "version": 2 }
    ]
  */

  -- 에러 정보 (실패 시)
  error_info JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_scenario_templates_generation_mode
  ON scenario_templates(generation_mode);

CREATE INDEX IF NOT EXISTS idx_guided_plots_scenario
  ON guided_scenario_plots(scenario_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_templates_persona
  ON dynamic_scenario_templates(persona_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_templates_category
  ON dynamic_scenario_templates(scenario_category);

CREATE INDEX IF NOT EXISTS idx_dynamic_templates_trigger
  ON dynamic_scenario_templates(trigger_rule_id);

CREATE INDEX IF NOT EXISTS idx_guided_sessions_user
  ON guided_scenario_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_guided_sessions_status
  ON guided_scenario_sessions(status);

CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_user
  ON dynamic_scenario_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_template
  ON dynamic_scenario_sessions(template_id);

CREATE INDEX IF NOT EXISTS idx_dynamic_sessions_status
  ON dynamic_scenario_sessions(status);

CREATE INDEX IF NOT EXISTS idx_generation_logs_persona
  ON scenario_generation_logs(persona_id);

CREATE INDEX IF NOT EXISTS idx_generation_logs_status
  ON scenario_generation_logs(status);

-- ============================================
-- 트리거 발동 기록 테이블 (user_trigger_history 확장)
-- ============================================

CREATE TABLE IF NOT EXISTS user_trigger_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_rule_id UUID NOT NULL REFERENCES event_trigger_rules(id),
  persona_id TEXT,

  -- 발동 시점
  triggered_at TIMESTAMPTZ DEFAULT NOW(),

  -- 발동 시점의 컨텍스트
  context JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "affection": 55,
      "relationship_stage": "interest",
      "message_content": "오늘 뭐해?",
      "session_message_count": 15,
      "hours_since_last_activity": 24
    }
  */

  -- 액션 결과
  action_type TEXT NOT NULL,
  action_result JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "scenario_started": true,
      "scenario_id": "xxx",
      "session_id": "yyy"
    }
  */

  -- 성공 여부
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_trigger_history_user
  ON user_trigger_history(user_id);

CREATE INDEX IF NOT EXISTS idx_user_trigger_history_trigger
  ON user_trigger_history(trigger_rule_id);

CREATE INDEX IF NOT EXISTS idx_user_trigger_history_triggered_at
  ON user_trigger_history(triggered_at);

-- ============================================
-- 유틸리티 함수
-- ============================================

-- 트리거 조건 평가 함수
CREATE OR REPLACE FUNCTION evaluate_trigger_conditions(
  p_trigger_id UUID,
  p_user_id UUID,
  p_persona_id TEXT,
  p_context JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_trigger RECORD;
  v_conditions JSONB;
  v_last_triggered TIMESTAMPTZ;
BEGIN
  -- 트리거 규칙 조회
  SELECT * INTO v_trigger
  FROM event_trigger_rules
  WHERE id = p_trigger_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_conditions := v_trigger.conditions;

  -- 쿨다운 체크
  SELECT triggered_at INTO v_last_triggered
  FROM user_trigger_history
  WHERE user_id = p_user_id
    AND trigger_rule_id = p_trigger_id
  ORDER BY triggered_at DESC
  LIMIT 1;

  IF v_last_triggered IS NOT NULL AND
     v_last_triggered > NOW() - (v_trigger.cooldown_hours || ' hours')::INTERVAL THEN
    RETURN false;
  END IF;

  -- 최소 호감도 체크
  IF v_conditions ? 'minAffection' AND
     (p_context->>'affection')::INT < (v_conditions->>'minAffection')::INT THEN
    RETURN false;
  END IF;

  -- 최대 호감도 체크
  IF v_conditions ? 'maxAffection' AND
     (p_context->>'affection')::INT > (v_conditions->>'maxAffection')::INT THEN
    RETURN false;
  END IF;

  -- 관계 단계 체크
  IF v_conditions ? 'relationshipStage' THEN
    IF NOT (p_context->>'relationship_stage') = ANY(
      SELECT jsonb_array_elements_text(v_conditions->'relationshipStage')
    ) THEN
      RETURN false;
    END IF;
  END IF;

  -- 비활성 시간 체크
  IF v_conditions ? 'hoursSinceLastActivity' THEN
    IF v_conditions->'hoursSinceLastActivity' ? 'min' AND
       (p_context->>'hours_since_last_activity')::INT <
       (v_conditions->'hoursSinceLastActivity'->>'min')::INT THEN
      RETURN false;
    END IF;
    IF v_conditions->'hoursSinceLastActivity' ? 'max' AND
       (p_context->>'hours_since_last_activity')::INT >
       (v_conditions->'hoursSinceLastActivity'->>'max')::INT THEN
      RETURN false;
    END IF;
  END IF;

  -- 모든 조건 통과
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 활성 트리거 목록 조회
CREATE OR REPLACE FUNCTION get_active_triggers_for_context(
  p_user_id UUID,
  p_persona_id TEXT,
  p_context JSONB
) RETURNS TABLE (
  trigger_id UUID,
  trigger_name TEXT,
  action_type TEXT,
  priority INTEGER,
  scenario_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    etr.id,
    etr.name,
    etr.action_type,
    etr.priority,
    etr.scenario_config
  FROM event_trigger_rules etr
  WHERE etr.is_active = true
    AND (etr.persona_id = p_persona_id OR etr.persona_id IS NULL)
    AND evaluate_trigger_conditions(etr.id, p_user_id, p_persona_id, p_context)
  ORDER BY etr.priority DESC;
END;
$$ LANGUAGE plpgsql;
