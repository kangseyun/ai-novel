-- 마케팅 캠페인 및 광고 집행 이력 관리
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'tiktok', 'google', 'other')),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, archived
  external_campaign_id TEXT, -- Meta/TikTok 상의 캠페인 ID
  budget_daily DECIMAL(10, 2),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 개별 광고 소재 집행 이력 (어떤 이미지가 어떤 플랫폼에 올라갔는지)
CREATE TABLE IF NOT EXISTS marketing_ad_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES marketing_campaigns(id),
  image_id UUID REFERENCES marketing_images(id), -- 우리가 생성한 이미지 ID
  platform TEXT NOT NULL,
  external_ad_id TEXT, -- Meta/TikTok 상의 광고 ID
  external_creative_id TEXT, -- 소재 ID
  status TEXT DEFAULT 'pending', -- pending, uploaded, active, rejected
  performance_data JSONB DEFAULT '{}'::jsonb, -- CTR, CPC 등 성과 데이터 캐싱
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_marketing_ad_executions_image_id ON marketing_ad_executions(image_id);
