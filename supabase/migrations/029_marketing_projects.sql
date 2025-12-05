-- ============================================
-- 마케팅 프로젝트 및 컨텐츠 관리 테이블
-- ============================================

-- 마케팅 프로젝트 테이블
CREATE TABLE IF NOT EXISTS marketing_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  target_platform TEXT DEFAULT 'meta' CHECK (target_platform IN ('meta', 'google', 'tiktok', 'all')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 마케팅 이미지 테이블
CREATE TABLE IF NOT EXISTS marketing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES marketing_projects(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES persona_core(id) ON DELETE SET NULL,
  persona_name TEXT NOT NULL,

  -- 이미지 정보
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- 생성 설정
  ad_size TEXT NOT NULL, -- 'feed-square', 'feed-portrait', 'story', 'carousel'
  ad_size_label TEXT NOT NULL, -- '피드 정사각형 (1:1)'
  template TEXT NOT NULL, -- 'romantic-chat', 'mysterious-encounter', etc.
  template_label TEXT NOT NULL,
  custom_prompt TEXT,

  -- 생성된 프롬프트
  generated_prompt TEXT,

  -- 메타데이터
  width INTEGER,
  height INTEGER,
  file_size INTEGER,

  -- 상태
  status TEXT DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'approved', 'rejected', 'used')),
  used_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_marketing_projects_status ON marketing_projects(status);
CREATE INDEX IF NOT EXISTS idx_marketing_images_project_id ON marketing_images(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_images_persona_id ON marketing_images(persona_id);
CREATE INDEX IF NOT EXISTS idx_marketing_images_ad_size ON marketing_images(ad_size);
CREATE INDEX IF NOT EXISTS idx_marketing_images_status ON marketing_images(status);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_marketing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_marketing_projects_updated_at ON marketing_projects;
CREATE TRIGGER trigger_marketing_projects_updated_at
  BEFORE UPDATE ON marketing_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

DROP TRIGGER IF EXISTS trigger_marketing_images_updated_at ON marketing_images;
CREATE TRIGGER trigger_marketing_images_updated_at
  BEFORE UPDATE ON marketing_images
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

-- RLS 정책 (관리자만 접근)
ALTER TABLE marketing_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_images ENABLE ROW LEVEL SECURITY;

-- 관리자용 정책 (service_role은 항상 접근 가능)
CREATE POLICY "Allow all for service role on marketing_projects"
  ON marketing_projects FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all for service role on marketing_images"
  ON marketing_images FOR ALL
  USING (true)
  WITH CHECK (true);
