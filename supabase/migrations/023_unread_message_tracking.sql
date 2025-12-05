-- ============================================
-- 읽지 않은 메시지 추적 시스템
-- ============================================
-- 목적: DM 페이지에서 읽지 않은 메시지 카운트 표시

-- 1. conversation_messages 테이블에 read 컬럼 추가
ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT true;

-- 2. 페르소나가 보낸 메시지는 기본적으로 읽지 않음
-- (유저가 DM 페이지를 열면 읽음 처리)
CREATE OR REPLACE FUNCTION set_message_read_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 유저가 보낸 메시지는 자동으로 읽음 처리
  IF NEW.role = 'user' THEN
    NEW.is_read = true;
  -- 페르소나가 보낸 메시지는 읽지 않음 상태로 시작
  ELSE
    NEW.is_read = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_message_read_status ON conversation_messages;
CREATE TRIGGER trigger_set_message_read_status
  BEFORE INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_message_read_status();

-- 3. 유저-페르소나별 읽지 않은 메시지 수 조회 함수
CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id UUID)
RETURNS TABLE (
  persona_id TEXT,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.persona_id,
    COUNT(cm.id)::BIGINT AS unread_count
  FROM conversation_sessions cs
  JOIN conversation_messages cm ON cm.session_id = cs.id
  WHERE cs.user_id = p_user_id
    AND cm.role = 'persona'
    AND cm.is_read = false
  GROUP BY cs.persona_id;
END;
$$ LANGUAGE plpgsql;

-- 4. 특정 페르소나와의 대화를 읽음으로 표시
CREATE OR REPLACE FUNCTION mark_messages_as_read(
  p_user_id UUID,
  p_persona_id TEXT
)
RETURNS INT AS $$
DECLARE
  v_updated_count INT;
BEGIN
  WITH updated AS (
    UPDATE conversation_messages cm
    SET is_read = true
    FROM conversation_sessions cs
    WHERE cm.session_id = cs.id
      AND cs.user_id = p_user_id
      AND cs.persona_id = p_persona_id
      AND cm.role = 'persona'
      AND cm.is_read = false
    RETURNING cm.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 읽지 않은 메시지 인덱스
CREATE INDEX IF NOT EXISTS idx_conversation_messages_unread
ON conversation_messages(is_read)
WHERE is_read = false AND role = 'persona';

-- 6. 기존 페르소나 메시지를 읽음 상태로 업데이트 (마이그레이션 시)
-- 이미 있는 메시지는 모두 읽은 것으로 처리
UPDATE conversation_messages
SET is_read = true
WHERE is_read IS NULL;

-- 7. 총 읽지 않은 메시지 수 조회 함수
CREATE OR REPLACE FUNCTION get_total_unread_count(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM conversation_messages cm
  JOIN conversation_sessions cs ON cm.session_id = cs.id
  WHERE cs.user_id = p_user_id
    AND cm.role = 'persona'
    AND cm.is_read = false;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;
