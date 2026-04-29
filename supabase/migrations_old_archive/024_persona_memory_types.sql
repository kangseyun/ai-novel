-- ============================================
-- 페르소나별 기억 타입 테이블
-- ============================================
-- 목적: 각 페르소나마다 고유한 기억 타입을 정의

-- 1. 페르소나별 기억 타입 테이블
CREATE TABLE IF NOT EXISTS persona_memory_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

  -- 기억 타입 정보
  type_id TEXT NOT NULL,              -- 고유 ID (예: 'idol_behind')
  title TEXT NOT NULL,                -- 표시 이름 (예: '아이돌 비하인드')
  description TEXT,                   -- 설명
  emoji TEXT DEFAULT '📝',            -- 아이콘

  -- 해금 조건
  min_affection INTEGER,              -- 최소 호감도
  min_stage TEXT,                     -- 최소 관계 단계
  required_flag TEXT,                 -- 필수 플래그

  -- 정렬 및 메타데이터
  display_order INTEGER DEFAULT 0,    -- 표시 순서
  is_default BOOLEAN DEFAULT false,   -- 기본 제공 여부
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 같은 페르소나에서 type_id 중복 방지
  UNIQUE(persona_id, type_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_persona_memory_types_persona
ON persona_memory_types(persona_id);

CREATE INDEX IF NOT EXISTS idx_persona_memory_types_order
ON persona_memory_types(persona_id, display_order);

-- 2. 기본 기억 타입 (모든 페르소나 공통)
-- 새 페르소나 추가 시 이 템플릿을 복사
CREATE TABLE IF NOT EXISTS default_memory_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '📝',
  min_affection INTEGER,
  min_stage TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 기본 기억 타입 데이터 삽입
INSERT INTO default_memory_types (type_id, title, description, emoji, min_affection, min_stage, display_order) VALUES
  ('first_meeting', '첫 만남', '처음 대화를 나눈 순간', '✨', NULL, NULL, 1),
  ('promise', '약속', '함께 한 약속들', '🤙', NULL, NULL, 2),
  ('secret_shared', '비밀', '서로 나눈 비밀 이야기', '🤫', 30, 'friend', 3),
  ('conflict', '갈등', '함께 겪은 갈등의 순간', '⚡', 20, NULL, 4),
  ('reconciliation', '화해', '갈등 후 화해한 순간', '🤗', 30, NULL, 5),
  ('intimate_moment', '특별한 순간', '마음이 가까워진 순간', '💕', 50, 'close', 6),
  ('gift_received', '선물', '주고받은 선물들', '🎁', NULL, 'acquaintance', 7),
  ('milestone', '기념일', '함께한 특별한 날들', '🎉', NULL, NULL, 8)
ON CONFLICT (type_id) DO NOTHING;

-- 4. Jun 페르소나 전용 기억 타입 삽입
-- (personas 테이블에 Jun이 있다고 가정)
INSERT INTO persona_memory_types (persona_id, type_id, title, description, emoji, min_affection, min_stage, display_order, is_default) VALUES
  ('jun', 'first_meeting', '첫 만남', '처음 대화를 나눈 순간', '✨', NULL, NULL, 1, true),
  ('jun', 'promise', '약속', '함께 한 약속들', '🤙', NULL, NULL, 2, true),
  ('jun', 'secret_shared', '비밀', '준이 털어놓은 비밀', '🤫', 30, 'friend', 3, true),
  ('jun', 'idol_behind', '아이돌 비하인드', '무대 뒤에서 일어난 특별한 순간', '🎤', 40, NULL, 4, false),
  ('jun', 'late_night_talk', '새벽 대화', '불면의 밤, 서로에게 기댄 시간', '🌙', 50, 'close', 5, false),
  ('jun', 'escape_together', '함께한 탈출', '바쁜 스케줄에서 벗어난 순간', '🏃', 60, 'intimate', 6, false),
  ('jun', 'vulnerability', '솔직한 고백', '가면을 벗고 보여준 진짜 모습', '💔', 70, 'intimate', 7, false),
  ('jun', 'future_dream', '미래의 꿈', '함께 그린 미래의 이야기', '🌟', 80, 'lover', 8, false)
ON CONFLICT (persona_id, type_id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  min_affection = EXCLUDED.min_affection,
  min_stage = EXCLUDED.min_stage,
  display_order = EXCLUDED.display_order;

-- 5. 새 페르소나 생성 시 기본 기억 타입 복사 함수
CREATE OR REPLACE FUNCTION copy_default_memory_types()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO persona_memory_types (persona_id, type_id, title, description, emoji, min_affection, min_stage, display_order, is_default)
  SELECT
    NEW.id,
    type_id,
    title,
    description,
    emoji,
    min_affection,
    min_stage,
    display_order,
    true
  FROM default_memory_types;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: 새 페르소나 추가 시 자동으로 기본 기억 타입 복사
DROP TRIGGER IF EXISTS trigger_copy_default_memory_types ON personas;
CREATE TRIGGER trigger_copy_default_memory_types
  AFTER INSERT ON personas
  FOR EACH ROW
  EXECUTE FUNCTION copy_default_memory_types();

-- 6. 페르소나 기억 타입 조회 함수
CREATE OR REPLACE FUNCTION get_persona_memory_types(p_persona_id TEXT)
RETURNS TABLE (
  type_id TEXT,
  title TEXT,
  description TEXT,
  emoji TEXT,
  min_affection INTEGER,
  min_stage TEXT,
  required_flag TEXT,
  display_order INTEGER,
  is_default BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pmt.type_id,
    pmt.title,
    pmt.description,
    pmt.emoji,
    pmt.min_affection,
    pmt.min_stage,
    pmt.required_flag,
    pmt.display_order,
    pmt.is_default
  FROM persona_memory_types pmt
  WHERE pmt.persona_id = p_persona_id
  ORDER BY pmt.display_order ASC;
END;
$$ LANGUAGE plpgsql;
