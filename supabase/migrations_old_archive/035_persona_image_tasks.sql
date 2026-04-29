-- ============================================
-- 페르소나 이미지 생성 태스크 및 히스토리
-- ============================================

-- 이미지 생성 태스크 테이블
-- NOTE: persona_core.id는 TEXT 타입이므로 persona_id도 TEXT로 설정
CREATE TABLE IF NOT EXISTS persona_image_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL REFERENCES persona_core(id) ON DELETE CASCADE,
  external_task_id TEXT NOT NULL, -- Kling AI task ID
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  prompt TEXT,
  image_type TEXT DEFAULT 'profile',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_persona_image_tasks_persona_id ON persona_image_tasks(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_image_tasks_status ON persona_image_tasks(status);
CREATE INDEX IF NOT EXISTS idx_persona_image_tasks_external_id ON persona_image_tasks(external_task_id);

-- 페르소나 이미지 히스토리 테이블
CREATE TABLE IF NOT EXISTS persona_image_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL REFERENCES persona_core(id) ON DELETE CASCADE,
  task_id UUID REFERENCES persona_image_tasks(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  prompt TEXT,
  is_current BOOLEAN DEFAULT FALSE, -- 현재 프로필 이미지 여부
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_persona_image_history_persona_id ON persona_image_history(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_image_history_is_current ON persona_image_history(is_current);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE persona_image_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE persona_image_history;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_persona_image_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_persona_image_tasks_updated_at
  BEFORE UPDATE ON persona_image_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_persona_image_tasks_updated_at();

-- 현재 이미지 설정 시 다른 이미지의 is_current를 false로
CREATE OR REPLACE FUNCTION set_single_current_image()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = TRUE THEN
    UPDATE persona_image_history
    SET is_current = FALSE
    WHERE persona_id = NEW.persona_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_single_current_image
  BEFORE INSERT OR UPDATE ON persona_image_history
  FOR EACH ROW
  EXECUTE FUNCTION set_single_current_image();
