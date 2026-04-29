-- ============================================
-- 시나리오 완료 보상 시스템
-- ============================================

-- 1. 보상 유형 테이블
CREATE TABLE IF NOT EXISTS reward_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- 아이콘 이름 또는 URL
  category TEXT NOT NULL CHECK (category IN (
    'currency',       -- 게임 내 화폐 (코인, 젬 등)
    'content',        -- 콘텐츠 잠금 해제
    'cosmetic',       -- 꾸미기 아이템
    'boost',          -- 버프/부스터
    'special'         -- 특별 보상
  )),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 시나리오 보상 설정 (시나리오별 보상 정의)
CREATE TABLE IF NOT EXISTS scenario_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL REFERENCES scenario_templates(id) ON DELETE CASCADE,
  reward_type_id TEXT NOT NULL REFERENCES reward_types(id) ON DELETE CASCADE,
  -- 보상 조건
  condition_type TEXT NOT NULL DEFAULT 'completion' CHECK (condition_type IN (
    'completion',      -- 시나리오 완료 시
    'first_completion', -- 첫 완료 시만
    'choice_based',    -- 특정 선택지 선택 시
    'perfect_run',     -- 모든 최적 선택지 선택 시
    'speed_run'        -- 특정 시간 내 완료 시
  )),
  -- 선택지 기반 조건일 경우
  required_choice_ids TEXT[] DEFAULT '{}',
  -- 보상 수량 (currency 타입인 경우)
  amount INTEGER DEFAULT 1,
  -- 보상 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,
  -- 표시 순서
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 유저 보상 수령 기록
CREATE TABLE IF NOT EXISTS user_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  scenario_reward_id UUID NOT NULL REFERENCES scenario_rewards(id) ON DELETE CASCADE,
  reward_type_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  -- 수령 시점 정보
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  -- 어떤 선택지를 선택했는지 (분석용)
  choices_made JSONB DEFAULT '[]'::jsonb,
  -- 시나리오 완료 시간 (speed_run 체크용)
  completion_time_seconds INTEGER,

  -- 같은 시나리오에서 같은 보상을 중복 수령하지 않도록
  UNIQUE(user_id, scenario_reward_id)
);

-- 4. 유저 보상 잔액 (currency 타입용)
CREATE TABLE IF NOT EXISTS user_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency_type TEXT NOT NULL,  -- 'coins', 'gems', 'hearts' 등
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, currency_type)
);

-- 5. 유저 보유 아이템 (content, cosmetic 타입용)
CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,      -- reward_type_id
  item_id TEXT NOT NULL,        -- 구체적인 아이템 ID
  quantity INTEGER DEFAULT 1,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  acquired_from TEXT,           -- 'scenario_reward', 'purchase', 'gift' 등
  source_id TEXT,               -- scenario_id 또는 order_id 등
  metadata JSONB DEFAULT '{}'::jsonb,

  UNIQUE(user_id, item_type, item_id)
);

-- 6. 시나리오 템플릿에 보상 요약 필드 추가
ALTER TABLE scenario_templates ADD COLUMN IF NOT EXISTS
  reward_summary JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- 기본 보상 유형 삽입
-- ============================================

INSERT INTO reward_types (id, name, description, icon, category) VALUES
  ('coins', '코인', '기본 게임 화폐', 'coins', 'currency'),
  ('gems', '젬', '프리미엄 화폐', 'gem', 'currency'),
  ('hearts', '하트', '호감도 부스터', 'heart', 'currency'),
  ('story_unlock', '스토리 잠금해제', '특별 스토리 콘텐츠 해금', 'book-open', 'content'),
  ('chat_theme', '채팅 테마', '채팅 배경 테마', 'palette', 'cosmetic'),
  ('profile_frame', '프로필 프레임', '프로필 꾸미기 프레임', 'frame', 'cosmetic'),
  ('affection_boost', '호감도 부스터', '일정 시간 호감도 획득량 증가', 'zap', 'boost'),
  ('exclusive_photo', '포토카드', '캐릭터 포토카드', 'image', 'special'),
  ('voice_message', '음성 메시지', '특별 음성 메시지 해금', 'mic', 'special')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_scenario_rewards_scenario
  ON scenario_rewards(scenario_id);
CREATE INDEX IF NOT EXISTS idx_user_reward_claims_user
  ON user_reward_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_user
  ON user_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user
  ON user_inventory(user_id);

-- ============================================
-- 보상 지급 함수
-- ============================================

CREATE OR REPLACE FUNCTION grant_scenario_reward(
  p_user_id UUID,
  p_scenario_id TEXT,
  p_choices_made JSONB DEFAULT '[]'::jsonb,
  p_completion_time_seconds INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_reward RECORD;
  v_granted_rewards JSONB := '[]'::jsonb;
  v_already_claimed BOOLEAN;
  v_condition_met BOOLEAN;
  v_is_first_completion BOOLEAN;
BEGIN
  -- 첫 완료인지 확인
  SELECT NOT EXISTS (
    SELECT 1 FROM user_reward_claims
    WHERE user_id = p_user_id AND scenario_id = p_scenario_id
  ) INTO v_is_first_completion;

  -- 해당 시나리오의 모든 활성 보상 조회
  FOR v_reward IN
    SELECT sr.*, rt.category, rt.name as reward_name
    FROM scenario_rewards sr
    JOIN reward_types rt ON sr.reward_type_id = rt.id
    WHERE sr.scenario_id = p_scenario_id
      AND sr.is_active = true
      AND rt.is_active = true
    ORDER BY sr.display_order
  LOOP
    -- 이미 수령했는지 확인
    SELECT EXISTS (
      SELECT 1 FROM user_reward_claims
      WHERE user_id = p_user_id AND scenario_reward_id = v_reward.id
    ) INTO v_already_claimed;

    IF v_already_claimed THEN
      CONTINUE;
    END IF;

    -- 조건 충족 확인
    v_condition_met := false;

    CASE v_reward.condition_type
      WHEN 'completion' THEN
        v_condition_met := true;
      WHEN 'first_completion' THEN
        v_condition_met := v_is_first_completion;
      WHEN 'choice_based' THEN
        -- choices_made 배열에 required_choice_ids가 포함되어 있는지 확인
        v_condition_met := (
          SELECT bool_and(choice_id = ANY(
            SELECT jsonb_array_elements_text(p_choices_made)
          ))
          FROM unnest(v_reward.required_choice_ids) AS choice_id
        );
      WHEN 'speed_run' THEN
        v_condition_met := (
          p_completion_time_seconds IS NOT NULL
          AND p_completion_time_seconds <= COALESCE((v_reward.metadata->>'max_seconds')::int, 9999999)
        );
      ELSE
        v_condition_met := true;
    END CASE;

    IF NOT v_condition_met THEN
      CONTINUE;
    END IF;

    -- 보상 수령 기록
    INSERT INTO user_reward_claims (
      user_id, scenario_id, scenario_reward_id, reward_type_id,
      amount, choices_made, completion_time_seconds
    ) VALUES (
      p_user_id, p_scenario_id, v_reward.id, v_reward.reward_type_id,
      v_reward.amount, p_choices_made, p_completion_time_seconds
    );

    -- 카테고리별 보상 지급
    CASE v_reward.category
      WHEN 'currency' THEN
        INSERT INTO user_balances (user_id, currency_type, balance, total_earned)
        VALUES (p_user_id, v_reward.reward_type_id, v_reward.amount, v_reward.amount)
        ON CONFLICT (user_id, currency_type)
        DO UPDATE SET
          balance = user_balances.balance + v_reward.amount,
          total_earned = user_balances.total_earned + v_reward.amount,
          updated_at = NOW();

      WHEN 'content', 'cosmetic', 'special' THEN
        INSERT INTO user_inventory (
          user_id, item_type, item_id, quantity,
          acquired_from, source_id, metadata
        ) VALUES (
          p_user_id, v_reward.reward_type_id,
          COALESCE(v_reward.metadata->>'item_id', v_reward.id::text),
          v_reward.amount, 'scenario_reward', p_scenario_id, v_reward.metadata
        )
        ON CONFLICT (user_id, item_type, item_id)
        DO UPDATE SET
          quantity = user_inventory.quantity + v_reward.amount;

      WHEN 'boost' THEN
        -- 부스터는 별도 처리 (만료 시간 등)
        INSERT INTO user_inventory (
          user_id, item_type, item_id, quantity,
          acquired_from, source_id, metadata
        ) VALUES (
          p_user_id, v_reward.reward_type_id,
          v_reward.id::text,
          v_reward.amount, 'scenario_reward', p_scenario_id,
          jsonb_build_object(
            'expires_at', NOW() + INTERVAL '1 day' * COALESCE((v_reward.metadata->>'duration_days')::int, 1)
          ) || v_reward.metadata
        );
    END CASE;

    -- 지급된 보상 목록에 추가
    v_granted_rewards := v_granted_rewards || jsonb_build_object(
      'reward_id', v_reward.id,
      'type', v_reward.reward_type_id,
      'name', v_reward.reward_name,
      'amount', v_reward.amount,
      'category', v_reward.category
    );
  END LOOP;

  RETURN v_granted_rewards;
END;
$$ LANGUAGE plpgsql;
