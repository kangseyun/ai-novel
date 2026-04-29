-- ============================================
-- 페르소나 이미지 히스토리 중복 방지
-- ============================================

-- task_id가 있는 경우 중복 삽입 방지를 위한 unique index
-- NULL task_id는 여러 개 허용 (수동 업로드 등)
CREATE UNIQUE INDEX IF NOT EXISTS idx_persona_image_history_unique_task_id
  ON persona_image_history(task_id)
  WHERE task_id IS NOT NULL;

-- 같은 task_id로 이미 히스토리가 있는지 확인하는 함수
CREATE OR REPLACE FUNCTION prevent_duplicate_image_history()
RETURNS TRIGGER AS $$
BEGIN
  -- task_id가 있는 경우에만 중복 체크
  IF NEW.task_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM persona_image_history
      WHERE task_id = NEW.task_id
    ) THEN
      -- 이미 존재하면 삽입 무시 (에러 대신 조용히 스킵)
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 중복 방지 트리거 (INSERT 전에 실행)
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_image_history ON persona_image_history;
CREATE TRIGGER trigger_prevent_duplicate_image_history
  BEFORE INSERT ON persona_image_history
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_image_history();
