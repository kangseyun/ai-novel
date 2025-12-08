-- ============================================
-- 온보딩 관리 시스템
-- 온보딩에 표시될 페르소나 및 설정 관리
-- ============================================

-- 1. 온보딩 페르소나 설정 테이블
-- persona_core와 연결하여 온보딩에서 사용할 페르소나 관리
CREATE TABLE IF NOT EXISTS onboarding_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL REFERENCES persona_core(id) ON DELETE CASCADE,

  -- 온보딩에서 표시될 정보 (다국어 지원)
  display_name JSONB DEFAULT '{"ko": "", "en": ""}'::jsonb,
  teaser_line JSONB DEFAULT '{"ko": "", "en": ""}'::jsonb,

  -- 온보딩용 이미지 (별도 설정 가능)
  onboarding_image_url TEXT,

  -- 테마 컬러
  theme_color TEXT DEFAULT '#8B5CF6',

  -- 표시 순서 (낮을수록 먼저 표시)
  display_order INT DEFAULT 0,

  -- 활성화 상태
  is_active BOOLEAN DEFAULT true,

  -- 온보딩 전용 첫 만남 시나리오 ID (null이면 persona_core.first_scenario_id 사용)
  onboarding_scenario_id TEXT REFERENCES scenario_templates(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(persona_id)
);

-- 2. 온보딩 전역 설정 테이블
CREATE TABLE IF NOT EXISTS onboarding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 설정 키
  setting_key TEXT UNIQUE NOT NULL,

  -- 설정 값
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 설명
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 온보딩 A/B 테스트 설정
INSERT INTO onboarding_settings (setting_key, setting_value, description)
VALUES
  ('variant_weights', '{"A": 0.33, "B": 0.33, "C": 0.34}'::jsonb, '온보딩 타입별 가중치 (A/B/C)'),
  ('default_variant', '"B"'::jsonb, '기본 온보딩 타입'),
  ('show_skip_button', 'true'::jsonb, '스킵 버튼 표시 여부'),
  ('max_personas_display', '5'::jsonb, '온보딩에서 최대 표시할 페르소나 수')
ON CONFLICT (setting_key) DO NOTHING;

-- 4. scenario_templates에 온보딩 전용 타입 추가를 위한 체크 제약 업데이트
-- 기존 constraint 삭제 후 새로 생성
DO $$
BEGIN
  -- 기존 constraint가 있으면 삭제
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'scenario_templates_scenario_type_check'
  ) THEN
    ALTER TABLE scenario_templates DROP CONSTRAINT scenario_templates_scenario_type_check;
  END IF;

  -- 새 constraint 추가 (onboarding 타입 포함)
  ALTER TABLE scenario_templates ADD CONSTRAINT scenario_templates_scenario_type_check
    CHECK (scenario_type IN (
      'first_meeting',
      'story_episode',
      'dm_triggered',
      'scheduled_event',
      'milestone',
      'onboarding'
    ));
EXCEPTION
  WHEN others THEN
    -- 이미 올바른 constraint가 있을 수 있음
    NULL;
END $$;

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_onboarding_personas_active ON onboarding_personas(is_active);
CREATE INDEX IF NOT EXISTS idx_onboarding_personas_order ON onboarding_personas(display_order);
CREATE INDEX IF NOT EXISTS idx_onboarding_settings_key ON onboarding_settings(setting_key);

-- 6. RLS 정책
ALTER TABLE onboarding_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_settings ENABLE ROW LEVEL SECURITY;

-- 읽기는 모두 허용
CREATE POLICY "onboarding_personas_read_all" ON onboarding_personas
  FOR SELECT USING (true);

CREATE POLICY "onboarding_settings_read_all" ON onboarding_settings
  FOR SELECT USING (true);

-- 쓰기는 admin만
CREATE POLICY "onboarding_personas_admin_write" ON onboarding_personas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "onboarding_settings_admin_write" ON onboarding_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 7. 기존 Jun 페르소나를 온보딩에 추가 (초기 데이터)
INSERT INTO onboarding_personas (
  persona_id,
  display_name,
  teaser_line,
  theme_color,
  display_order,
  is_active,
  onboarding_scenario_id
)
SELECT
  'jun',
  '{"ko": "Jun", "en": "Jun"}'::jsonb,
  '{"ko": "새벽 3시. 편의점에서 만난 그는...", "en": "3AM. The stranger at the convenience store..."}'::jsonb,
  '#8B5CF6',
  1,
  true,
  'jun_first_meeting'
WHERE EXISTS (SELECT 1 FROM persona_core WHERE id = 'jun')
ON CONFLICT (persona_id) DO NOTHING;

-- 8. 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onboarding_personas_updated_at ON onboarding_personas;
CREATE TRIGGER onboarding_personas_updated_at
  BEFORE UPDATE ON onboarding_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();

DROP TRIGGER IF EXISTS onboarding_settings_updated_at ON onboarding_settings;
CREATE TRIGGER onboarding_settings_updated_at
  BEFORE UPDATE ON onboarding_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_updated_at();
