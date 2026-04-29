-- 웰컴 오퍼 추적을 위한 컬럼 추가
-- 가입 후 24시간 한정 특가 구매 여부 추적

ALTER TABLE users
ADD COLUMN IF NOT EXISTS welcome_offer_claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS welcome_offer_claimed_at TIMESTAMPTZ;

-- 웰컴 오퍼 구매 기록 테이블
CREATE TABLE IF NOT EXISTS welcome_offer_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'yearly')),
  original_price INTEGER NOT NULL, -- 원래 가격 (센트)
  paid_price INTEGER NOT NULL, -- 실제 결제 금액 (센트)
  discount_percent INTEGER NOT NULL, -- 할인율
  bonus_credits INTEGER NOT NULL, -- 지급된 보너스 크레딧
  stripe_subscription_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  offer_expires_at TIMESTAMPTZ NOT NULL, -- 오퍼 만료 시간 (가입 후 24시간)
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_welcome_offer_purchases_user_id
ON welcome_offer_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_welcome_offer_purchases_created_at
ON welcome_offer_purchases(created_at DESC);

-- RLS 정책
ALTER TABLE welcome_offer_purchases ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 구매 기록만 조회 가능
CREATE POLICY "Users can view own welcome offer purchases"
ON welcome_offer_purchases FOR SELECT
USING (auth.uid() = user_id);

-- 서버만 삽입 가능 (service_role)
CREATE POLICY "Service role can insert welcome offer purchases"
ON welcome_offer_purchases FOR INSERT
WITH CHECK (true);

-- 코멘트
COMMENT ON TABLE welcome_offer_purchases IS '가입 후 24시간 한정 특가 구매 기록';
COMMENT ON COLUMN users.welcome_offer_claimed IS '웰컴 오퍼 구매 여부';
COMMENT ON COLUMN users.welcome_offer_claimed_at IS '웰컴 오퍼 구매 시간';
