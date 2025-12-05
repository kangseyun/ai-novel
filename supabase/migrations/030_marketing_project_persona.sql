-- ============================================
-- 마케팅 프로젝트에 캐릭터 및 베이스 이미지 연결
-- ============================================

-- 프로젝트에 캐릭터 정보 추가
ALTER TABLE marketing_projects ADD COLUMN IF NOT EXISTS persona_id TEXT;
ALTER TABLE marketing_projects ADD COLUMN IF NOT EXISTS persona_name TEXT;
ALTER TABLE marketing_projects ADD COLUMN IF NOT EXISTS persona_avatar_url TEXT;

-- 베이스 이미지 정보 (선택된 베이스 이미지 URL)
ALTER TABLE marketing_projects ADD COLUMN IF NOT EXISTS base_image_url TEXT;
ALTER TABLE marketing_projects ADD COLUMN IF NOT EXISTS base_template TEXT;
ALTER TABLE marketing_projects ADD COLUMN IF NOT EXISTS base_custom_prompt TEXT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_marketing_projects_persona_id ON marketing_projects(persona_id);
