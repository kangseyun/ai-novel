-- ============================================
-- personas 테이블을 View로 대체
-- personas 테이블 통합을 위한 3단계
-- ============================================

-- 1. 기존 personas 테이블 백업 (이름 변경)
ALTER TABLE personas RENAME TO personas_legacy;

-- 2. personas View 생성
-- persona_core 기반으로 personas와 동일한 구조의 View 생성
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

-- 3. View에 대한 권한 설정
GRANT SELECT ON personas TO authenticated;
GRANT SELECT ON personas TO anon;
