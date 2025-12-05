-- 연속 출석 스트릭 시스템

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- 출석 체크 함수
CREATE OR REPLACE FUNCTION check_daily_streak(p_user_id UUID) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_streak INTEGER;
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  v_bonus_tokens INTEGER := 0;
BEGIN
  SELECT streak_count, last_active_date 
  INTO v_streak, v_last_date 
  FROM users 
  WHERE id = p_user_id;

  -- 오늘 이미 출석했으면 패스
  IF v_last_date = v_today THEN
    RETURN jsonb_build_object('updated', false, 'streak', v_streak);
  END IF;

  -- 어제 출석했으면 +1, 아니면 1로 초기화
  IF v_last_date = v_today - 1 THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;

  -- 7일 연속 출석 시 보너스 (예: 50 크레딧)
  IF v_streak > 0 AND v_streak % 7 = 0 THEN
    v_bonus_tokens := 50;
    PERFORM add_tokens(p_user_id, v_bonus_tokens);
  END IF;

  -- 업데이트
  UPDATE users 
  SET streak_count = v_streak,
      last_active_date = v_today
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'updated', true, 
    'streak', v_streak, 
    'bonus', v_bonus_tokens
  );
END;
$$;
