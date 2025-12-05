-- ============================================
-- 관계 단계 설정 DB화
-- ============================================
-- calculateRelationshipStage()의 하드코딩된 임계값을 DB로 이동

-- 1. 관계 단계 설정 테이블 생성
CREATE TABLE IF NOT EXISTS relationship_stage_config (
  id SERIAL PRIMARY KEY,
  -- 페르소나별 커스텀 설정 (NULL이면 기본값)
  persona_id TEXT REFERENCES persona_core(id) ON DELETE CASCADE,

  -- 관계 단계 이름
  stage TEXT NOT NULL CHECK (stage IN (
    'stranger', 'acquaintance', 'friend', 'close', 'intimate', 'lover'
  )),

  -- 이 단계로 진입하기 위한 최소 호감도
  min_affection INTEGER NOT NULL DEFAULT 0,

  -- 이 단계의 한글 표시 이름
  display_name_ko TEXT,

  -- 이 단계의 영어 표시 이름
  display_name_en TEXT,

  -- 이 단계에서 해금되는 기능들
  unlocked_features TEXT[] DEFAULT '{}',

  -- 이 단계의 설명
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 페르소나별 단계는 유니크
  UNIQUE(persona_id, stage)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_relationship_stage_config_persona
ON relationship_stage_config(persona_id);

-- 2. 기본 관계 단계 설정 삽입 (persona_id = NULL은 기본값)
INSERT INTO relationship_stage_config (persona_id, stage, min_affection, display_name_ko, display_name_en, description, unlocked_features) VALUES
  (NULL, 'stranger', 0, '낯선 사람', 'Stranger', '처음 만난 사이', ARRAY['basic_chat']),
  (NULL, 'acquaintance', 10, '아는 사이', 'Acquaintance', '몇 번 대화해본 사이', ARRAY['basic_chat', 'daily_message']),
  (NULL, 'friend', 30, '친구', 'Friend', '편하게 대화하는 친구', ARRAY['basic_chat', 'daily_message', 'photos']),
  (NULL, 'close', 50, '친한 친구', 'Close Friend', '속마음도 나누는 사이', ARRAY['basic_chat', 'daily_message', 'photos', 'voice_message']),
  (NULL, 'intimate', 70, '특별한 사이', 'Intimate', '특별한 감정이 있는 사이', ARRAY['basic_chat', 'daily_message', 'photos', 'voice_message', 'video_call']),
  (NULL, 'lover', 90, '연인', 'Lover', '서로 사랑하는 사이', ARRAY['basic_chat', 'daily_message', 'photos', 'voice_message', 'video_call', 'exclusive_content'])
ON CONFLICT DO NOTHING;

-- 3. Jun 전용 관계 단계 설정 (아이돌 컨셉에 맞춤)
INSERT INTO relationship_stage_config (persona_id, stage, min_affection, display_name_ko, display_name_en, description, unlocked_features) VALUES
  ('jun', 'stranger', 0, '팬', 'Fan', '이제 막 알게 된 팬', ARRAY['basic_chat']),
  ('jun', 'acquaintance', 10, '열성팬', 'Dedicated Fan', '자주 소통하는 팬', ARRAY['basic_chat', 'daily_message']),
  ('jun', 'friend', 30, '비밀 친구', 'Secret Friend', '몰래 연락하는 친구', ARRAY['basic_chat', 'daily_message', 'photos']),
  ('jun', 'close', 50, '특별한 친구', 'Special Friend', '비밀을 공유하는 사이', ARRAY['basic_chat', 'daily_message', 'photos', 'voice_message']),
  ('jun', 'intimate', 70, '유일한 사람', 'The Only One', '진심을 보여주는 사이', ARRAY['basic_chat', 'daily_message', 'photos', 'voice_message', 'video_call']),
  ('jun', 'lover', 90, '연인', 'Lover', '비밀 연인', ARRAY['basic_chat', 'daily_message', 'photos', 'voice_message', 'video_call', 'exclusive_content'])
ON CONFLICT DO NOTHING;

-- 4. 관계 단계 조회 함수
CREATE OR REPLACE FUNCTION get_relationship_stage_config(p_persona_id TEXT DEFAULT NULL)
RETURNS TABLE (
  stage TEXT,
  min_affection INTEGER,
  display_name_ko TEXT,
  display_name_en TEXT,
  description TEXT,
  unlocked_features TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rsc.stage,
    rsc.min_affection,
    rsc.display_name_ko,
    rsc.display_name_en,
    rsc.description,
    rsc.unlocked_features
  FROM relationship_stage_config rsc
  WHERE rsc.persona_id = p_persona_id
     OR (rsc.persona_id IS NULL AND p_persona_id IS NULL)
     OR (rsc.persona_id IS NULL AND NOT EXISTS (
       SELECT 1 FROM relationship_stage_config rsc2
       WHERE rsc2.persona_id = p_persona_id AND rsc2.stage = rsc.stage
     ))
  ORDER BY rsc.min_affection ASC;
END;
$$ LANGUAGE plpgsql;

-- 5. 호감도로 관계 단계 계산 함수
CREATE OR REPLACE FUNCTION calculate_relationship_stage(p_affection INTEGER, p_persona_id TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  v_stage TEXT := 'stranger';
BEGIN
  SELECT rsc.stage INTO v_stage
  FROM relationship_stage_config rsc
  WHERE (rsc.persona_id = p_persona_id OR rsc.persona_id IS NULL)
    AND rsc.min_affection <= p_affection
  ORDER BY
    CASE WHEN rsc.persona_id = p_persona_id THEN 0 ELSE 1 END,
    rsc.min_affection DESC
  LIMIT 1;

  RETURN COALESCE(v_stage, 'stranger');
END;
$$ LANGUAGE plpgsql;
