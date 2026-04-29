-- ============================================
-- 페르소나 타겟 오디언스 필드 추가
-- 여성향/남성향/애니 카테고리 구분용
-- ============================================

-- target_audience 필드 추가
-- 'female' = 여성향 (남성 페르소나)
-- 'male' = 남성향 (여성 페르소나)
-- 'anime' = 애니 스타일 캐릭터
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'female';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_persona_core_target_audience ON persona_core(target_audience);

-- 기존 페르소나 target_audience 설정
-- Jun, Daniel, Kael, Adrian, Ren은 남성 페르소나 = 여성향
UPDATE persona_core SET target_audience = 'female' WHERE id IN ('jun', 'daniel', 'kael', 'adrian', 'ren');

-- Hana, Yuna는 여성 페르소나 = 남성향
UPDATE persona_core SET target_audience = 'male' WHERE id IN ('hana', 'yuna');

-- personas View 재생성 (target_audience 포함)
DROP VIEW IF EXISTS personas;

CREATE VIEW personas AS
SELECT
  id,
  name,
  COALESCE(display_name, name) AS display_name,
  COALESCE(username, id) AS username,
  full_name,
  bio,
  profile_image_url AS avatar_url,
  profile_image_url,
  cover_image_url,
  is_verified,
  is_active,
  is_premium,
  category,
  target_audience,
  tags,
  sort_order,
  followers_count,
  following_count,
  posts_count,
  gallery_images,
  age,
  ethnicity,
  appearance,
  voice_description,
  role,
  created_at,
  updated_at
FROM persona_core
WHERE is_active = true OR is_active IS NULL;

-- View에 대한 권한 설정
GRANT SELECT ON personas TO authenticated;
GRANT SELECT ON personas TO anon;

-- 초기 팔로우 완료 여부 추적 (users 테이블)
ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_follows_completed BOOLEAN DEFAULT false;

-- 선호 타겟 오디언스 저장 (users 테이블)
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_target_audience TEXT DEFAULT NULL;
