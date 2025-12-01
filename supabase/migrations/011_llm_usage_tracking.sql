-- ============================================
-- LLM Usage Tracking Tables
-- 유저별 LLM 토큰 사용량 및 예산 관리
-- ============================================

-- 1. LLM 사용 기록 테이블
CREATE TABLE IF NOT EXISTS llm_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 8) NOT NULL DEFAULT 0, -- USD (소수점 8자리까지)
  task_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_llm_usage_user_id ON llm_usage_records(user_id);
CREATE INDEX idx_llm_usage_created_at ON llm_usage_records(created_at);
CREATE INDEX idx_llm_usage_user_created ON llm_usage_records(user_id, created_at);

-- 2. 유저 LLM 예산 테이블
CREATE TABLE IF NOT EXISTS user_llm_budgets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 구독 플랜 기반 한도
  monthly_budget_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.50, -- 기본 free tier
  daily_budget_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.05,
  -- 현재 사용량
  current_month_usage_usd DECIMAL(10, 8) NOT NULL DEFAULT 0,
  current_day_usage_usd DECIMAL(10, 8) NOT NULL DEFAULT 0,
  -- 리셋 날짜
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 메타데이터
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 사용량 증가 함수 (atomic operation)
CREATE OR REPLACE FUNCTION increment_user_usage(
  p_user_id UUID,
  p_cost DECIMAL(10, 8)
)
RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_current_month TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
  v_last_reset_date DATE;
  v_last_reset_month TEXT;
BEGIN
  -- 유저 예산 레코드가 없으면 생성
  INSERT INTO user_llm_budgets (user_id, last_reset_date)
  VALUES (p_user_id, v_today)
  ON CONFLICT (user_id) DO NOTHING;

  -- 현재 리셋 날짜 확인
  SELECT last_reset_date INTO v_last_reset_date
  FROM user_llm_budgets
  WHERE user_id = p_user_id;

  v_last_reset_month := TO_CHAR(v_last_reset_date, 'YYYY-MM');

  -- 일일 리셋 필요 여부 확인
  IF v_last_reset_date < v_today THEN
    -- 새로운 날: 일일 사용량 리셋
    UPDATE user_llm_budgets
    SET
      current_day_usage_usd = p_cost,
      -- 새로운 달이면 월간 사용량도 리셋
      current_month_usage_usd = CASE
        WHEN v_last_reset_month < v_current_month THEN p_cost
        ELSE current_month_usage_usd + p_cost
      END,
      last_reset_date = v_today,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    -- 같은 날: 누적
    UPDATE user_llm_budgets
    SET
      current_day_usage_usd = current_day_usage_usd + p_cost,
      current_month_usage_usd = current_month_usage_usd + p_cost,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. 월간 사용량 집계 뷰
CREATE OR REPLACE VIEW user_monthly_usage AS
SELECT
  user_id,
  DATE_TRUNC('month', created_at) AS month,
  SUM(total_tokens) AS total_tokens,
  SUM(estimated_cost) AS total_cost_usd,
  COUNT(*) AS total_calls,
  jsonb_object_agg(
    COALESCE(model_id, 'unknown'),
    jsonb_build_object(
      'tokens', SUM(total_tokens),
      'cost', SUM(estimated_cost),
      'calls', COUNT(*)
    )
  ) FILTER (WHERE model_id IS NOT NULL) AS by_model
FROM llm_usage_records
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- 5. 일간 사용량 집계 뷰
CREATE OR REPLACE VIEW user_daily_usage AS
SELECT
  user_id,
  DATE(created_at) AS date,
  SUM(total_tokens) AS total_tokens,
  SUM(estimated_cost) AS total_cost_usd,
  COUNT(*) AS total_calls
FROM llm_usage_records
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY user_id, DATE(created_at);

-- 6. RLS 정책
ALTER TABLE llm_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_llm_budgets ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 사용 기록만 조회 가능
CREATE POLICY "Users can view own usage records"
  ON llm_usage_records FOR SELECT
  USING (auth.uid() = user_id);

-- 서비스 역할은 모든 작업 가능
CREATE POLICY "Service role can manage usage records"
  ON llm_usage_records FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- 사용자는 자신의 예산 정보만 조회 가능
CREATE POLICY "Users can view own budget"
  ON user_llm_budgets FOR SELECT
  USING (auth.uid() = user_id);

-- 서비스 역할은 모든 작업 가능
CREATE POLICY "Service role can manage budgets"
  ON user_llm_budgets FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- 7. 오래된 기록 정리 함수 (90일 이상)
CREATE OR REPLACE FUNCTION cleanup_old_usage_records()
RETURNS void AS $$
BEGIN
  DELETE FROM llm_usage_records
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- 8. 코멘트
COMMENT ON TABLE llm_usage_records IS '유저별 LLM API 호출 기록';
COMMENT ON TABLE user_llm_budgets IS '유저별 LLM 사용 예산 및 현재 사용량';
COMMENT ON FUNCTION increment_user_usage IS '유저 사용량 원자적 증가 (일/월 리셋 포함)';
