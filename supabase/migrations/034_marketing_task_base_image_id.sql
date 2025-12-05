-- ============================================
-- 마케팅 태스크에 베이스 이미지 ID 추가
-- ============================================

-- 베이스 이미지 ID 컬럼 추가 (정확한 부모-자식 연결을 위해)
ALTER TABLE marketing_generation_tasks
  ADD COLUMN IF NOT EXISTS selected_base_image_id UUID REFERENCES marketing_images(id) ON DELETE SET NULL;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_base_image_id ON marketing_generation_tasks(selected_base_image_id);
