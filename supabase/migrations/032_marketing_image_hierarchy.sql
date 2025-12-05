-- ============================================
-- 마케팅 이미지 계층 구조 (트리/그래프 뷰용)
-- ============================================

-- 부모 이미지 ID 추가 (베이스 이미지 → 파생 이미지 관계)
ALTER TABLE marketing_images
  ADD COLUMN IF NOT EXISTS parent_image_id UUID REFERENCES marketing_images(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_base BOOLEAN DEFAULT FALSE;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_marketing_images_parent_id ON marketing_images(parent_image_id);
CREATE INDEX IF NOT EXISTS idx_marketing_images_is_base ON marketing_images(is_base);

-- 베이스 이미지 그룹 ID (같은 프롬프트/설정으로 생성된 이미지들)
ALTER TABLE marketing_images
  ADD COLUMN IF NOT EXISTS generation_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_marketing_images_generation_group ON marketing_images(generation_group_id);
