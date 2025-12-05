-- 레퍼럴 시스템을 위한 스키마 업데이트

-- 1. users 테이블에 레퍼럴 관련 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by TEXT,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- 2. 기존 유저들에게 랜덤 초대 코드 발급 (이미 있는 경우 제외)
UPDATE users 
SET referral_code = SUBSTRING(MD5(id::text || NOW()::text) FROM 1 FOR 8)
WHERE referral_code IS NULL;

-- 3. 레퍼럴 코드 인덱스 (빠른 검색용)
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 4. 레퍼럴 등록 및 보상 지급 함수 (Atomic Transaction)
CREATE OR REPLACE FUNCTION claim_referral_reward(
  p_user_id UUID,
  p_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
  v_user_referral_code TEXT;
  v_already_referred TEXT;
  v_reward_amount INTEGER := 50; -- 보상 크레딧 양
BEGIN
  -- 1. 자기 자신의 코드가 아닌지 확인
  SELECT referral_code INTO v_user_referral_code FROM users WHERE id = p_user_id;
  IF v_user_referral_code = p_code THEN
    RETURN jsonb_build_object('success', false, 'message', 'cannot_refer_self');
  END IF;

  -- 2. 이미 추천인을 등록했는지 확인
  SELECT referred_by INTO v_already_referred FROM users WHERE id = p_user_id;
  IF v_already_referred IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'already_claimed');
  END IF;

  -- 3. 추천인(Referrer) 찾기
  SELECT id INTO v_referrer_id FROM users WHERE referral_code = p_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'invalid_code');
  END IF;

  -- 4. 트랜잭션 시작: 업데이트 및 보상 지급
  
  -- 4-1. 내 정보 업데이트 (추천인 등록)
  UPDATE users 
  SET referred_by = p_code 
  WHERE id = p_user_id;

  -- 4-2. 추천인 카운트 증가
  UPDATE users 
  SET referral_count = referral_count + 1 
  WHERE id = v_referrer_id;

  -- 4-3. 나에게 보상 지급 (크레딧 추가)
  PERFORM add_tokens(p_user_id, v_reward_amount);

  -- 4-4. 추천인에게 보상 지급 (크레딧 추가)
  PERFORM add_tokens(v_referrer_id, v_reward_amount);

  -- 5. 알림/이력 기록 (옵션 - analytics 테이블 등이 있다면 여기에 추가)
  
  RETURN jsonb_build_object(
    'success', true, 
    'reward_amount', v_reward_amount,
    'referrer_id', v_referrer_id
  );
END;
$$;
