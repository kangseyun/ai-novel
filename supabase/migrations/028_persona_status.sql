-- ============================================
-- 페르소나 상태 필드 추가 (확정/실험실)
-- ============================================

-- persona_core에 status 컬럼 추가
-- 'published': 확정된 페르소나 (유저에게 공개)
-- 'lab': 실험실 페르소나 (관리자만 접근, 수정 중)
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'lab';

-- 유효한 상태값 체크 제약 조건
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_core_status_check'
  ) THEN
    ALTER TABLE persona_core ADD CONSTRAINT persona_core_status_check
      CHECK (status IN ('published', 'lab'));
  END IF;
END $$;

-- 기존 페르소나들은 published로 설정 (이미 사용 중인 것들)
UPDATE persona_core SET status = 'published' WHERE status IS NULL OR status = 'lab';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_persona_core_status ON persona_core(status);

-- 상태 변경 시간 추적을 위한 컬럼
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- published 상태로 변경 시 자동으로 published_at 설정하는 트리거
CREATE OR REPLACE FUNCTION update_persona_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_persona_published_at ON persona_core;
CREATE TRIGGER trigger_update_persona_published_at
  BEFORE UPDATE ON persona_core
  FOR EACH ROW
  EXECUTE FUNCTION update_persona_published_at();
