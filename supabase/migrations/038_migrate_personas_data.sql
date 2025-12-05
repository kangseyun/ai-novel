-- ============================================
-- personas 데이터를 persona_core로 마이그레이션
-- personas 테이블 통합을 위한 2단계
-- ============================================

-- 기존 personas 데이터를 persona_core로 복사
-- COALESCE를 사용하여 기존 값이 있으면 유지, 없으면 personas에서 가져옴
UPDATE persona_core pc
SET
  display_name = COALESCE(pc.display_name, p.display_name),
  username = COALESCE(pc.username, p.username),
  bio = COALESCE(pc.bio, p.bio),
  cover_image_url = COALESCE(pc.cover_image_url, p.cover_image_url),
  is_verified = COALESCE(p.is_verified, true),
  is_active = COALESCE(p.is_active, true),
  is_premium = COALESCE(p.is_premium, false),
  category = COALESCE(p.category, 'other'),
  tags = COALESCE(p.tags, '{}'),
  sort_order = COALESCE(p.sort_order, 0),
  followers_count = COALESCE(p.followers_count, '0'),
  following_count = COALESCE(p.following_count, 0),
  posts_count = COALESCE(p.posts_count, 0),
  gallery_images = COALESCE(p.gallery_images, '{}'),
  -- profile_image_url이 없으면 personas의 avatar_url 사용
  profile_image_url = COALESCE(pc.profile_image_url, p.avatar_url)
FROM personas p
WHERE pc.id = p.id;

-- persona_core에만 있고 personas에 없는 레코드에 기본값 설정
UPDATE persona_core
SET
  display_name = COALESCE(display_name, name),
  username = COALESCE(username, id),
  is_verified = COALESCE(is_verified, true),
  is_active = COALESCE(is_active, true),
  is_premium = COALESCE(is_premium, false),
  category = COALESCE(category, 'other'),
  tags = COALESCE(tags, '{}'),
  sort_order = COALESCE(sort_order, 0),
  followers_count = COALESCE(followers_count, '0'),
  following_count = COALESCE(following_count, 0),
  posts_count = COALESCE(posts_count, 0),
  gallery_images = COALESCE(gallery_images, '{}')
WHERE display_name IS NULL OR username IS NULL;
