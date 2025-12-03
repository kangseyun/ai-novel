-- ============================================
-- 원자적 토큰 관리 함수
-- Race Condition 방지를 위한 DB 레벨 함수
-- ============================================

-- 원자적 토큰 차감 함수
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_min_balance INTEGER DEFAULT 0
)
RETURNS TABLE(success BOOLEAN, previous_balance INTEGER, new_balance INTEGER) AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- FOR UPDATE로 행 잠금
  SELECT tokens INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- 잔액 부족 체크
  IF v_current_balance IS NULL OR v_current_balance < p_amount OR v_current_balance - p_amount < p_min_balance THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_current_balance, 0), COALESCE(v_current_balance, 0);
    RETURN;
  END IF;

  -- 원자적 차감
  UPDATE users
  SET tokens = tokens - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_current_balance, v_current_balance - p_amount;
END;
$$ LANGUAGE plpgsql;

-- 토큰 추가 함수 (보상/구매용)
CREATE OR REPLACE FUNCTION add_tokens(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS TABLE(success BOOLEAN, previous_balance INTEGER, new_balance INTEGER) AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  SELECT tokens INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0;
    RETURN;
  END IF;

  UPDATE users
  SET tokens = tokens + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_current_balance, v_current_balance + p_amount;
END;
$$ LANGUAGE plpgsql;
