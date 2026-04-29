-- ============================================
-- 마케팅 문구 저장 테이블 및 프로젝트 컨셉 필드 추가
-- ============================================

-- 마케팅 프로젝트에 컨셉 관련 필드 추가
ALTER TABLE marketing_projects
  ADD COLUMN IF NOT EXISTS marketing_concept TEXT,
  ADD COLUMN IF NOT EXISTS cta_goal TEXT;

-- 마케팅 문구 테이블 (제목, 본문, CTA 다중 버전)
CREATE TABLE IF NOT EXISTS marketing_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES marketing_projects(id) ON DELETE CASCADE,

  -- 문구 내용
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  cta TEXT NOT NULL,

  -- 버전 정보
  version INTEGER DEFAULT 1,
  variation_type TEXT, -- 'romantic', 'playful', 'mysterious' 등

  -- 상태
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'approved', 'rejected', 'used')),

  -- 성과 지표 (옵션)
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4), -- Click-through rate

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_marketing_copies_project_id ON marketing_copies(project_id);
CREATE INDEX IF NOT EXISTS idx_marketing_copies_status ON marketing_copies(status);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS trigger_marketing_copies_updated_at ON marketing_copies;
CREATE TRIGGER trigger_marketing_copies_updated_at
  BEFORE UPDATE ON marketing_copies
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_updated_at();

-- RLS 정책
ALTER TABLE marketing_copies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role on marketing_copies"
  ON marketing_copies FOR ALL
  USING (true)
  WITH CHECK (true);
