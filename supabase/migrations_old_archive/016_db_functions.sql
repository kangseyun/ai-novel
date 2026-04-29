-- ============================================
-- DB 함수 (RPC)
-- ============================================

-- 1. 이벤트 카운트 증가
CREATE OR REPLACE FUNCTION increment_events_today(p_user_id UUID, p_persona_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE user_event_state
  SET
    events_today = CASE
      WHEN events_today_reset_at = CURRENT_DATE THEN events_today + 1
      ELSE 1
    END,
    events_today_reset_at = CURRENT_DATE,
    updated_at = NOW()
  WHERE user_id = p_user_id AND persona_id = p_persona_id;

  -- 레코드가 없으면 생성
  IF NOT FOUND THEN
    INSERT INTO user_event_state (user_id, persona_id, events_today, events_today_reset_at)
    VALUES (p_user_id, p_persona_id, 1, CURRENT_DATE);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. 메모리 참조 카운트 증가
CREATE OR REPLACE FUNCTION increment_memory_reference(p_memory_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE persona_memories
  SET
    reference_count = reference_count + 1,
    last_referenced_at = NOW()
  WHERE id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- 3. 관계 통계 업데이트
CREATE OR REPLACE FUNCTION update_relationship_stats(
  p_user_id UUID,
  p_persona_id TEXT,
  p_message_increment INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE user_persona_relationships
  SET
    total_messages = total_messages + p_message_increment,
    last_interaction_at = NOW(),
    first_interaction_at = COALESCE(first_interaction_at, NOW()),
    updated_at = NOW()
  WHERE user_id = p_user_id AND persona_id = p_persona_id;
END;
$$ LANGUAGE plpgsql;

-- 4. 여정 통계 업데이트 (upsert with increment)
CREATE OR REPLACE FUNCTION update_journey_stats(
  p_user_id UUID,
  p_persona_id TEXT,
  p_dm_messages INTEGER DEFAULT 0,
  p_scenarios_completed INTEGER DEFAULT 0,
  p_choices_made INTEGER DEFAULT 0,
  p_time_spent INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_journey_stats (
    user_id,
    persona_id,
    total_dm_messages_sent,
    total_scenarios_completed,
    total_choices_made,
    total_time_spent_minutes
  )
  VALUES (
    p_user_id,
    p_persona_id,
    p_dm_messages,
    p_scenarios_completed,
    p_choices_made,
    p_time_spent
  )
  ON CONFLICT (user_id, persona_id)
  DO UPDATE SET
    total_dm_messages_sent = user_journey_stats.total_dm_messages_sent + p_dm_messages,
    total_scenarios_completed = user_journey_stats.total_scenarios_completed + p_scenarios_completed,
    total_choices_made = user_journey_stats.total_choices_made + p_choices_made,
    total_time_spent_minutes = user_journey_stats.total_time_spent_minutes + p_time_spent,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. 연속 활동 일수 업데이트
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID, p_persona_id TEXT)
RETURNS void AS $$
DECLARE
  v_last_active DATE;
  v_current_streak INTEGER;
  v_max_streak INTEGER;
BEGIN
  SELECT last_active_date, current_streak_days, max_streak_days
  INTO v_last_active, v_current_streak, v_max_streak
  FROM user_journey_stats
  WHERE user_id = p_user_id AND persona_id = p_persona_id;

  IF NOT FOUND THEN
    INSERT INTO user_journey_stats (user_id, persona_id, current_streak_days, max_streak_days, last_active_date, days_active)
    VALUES (p_user_id, p_persona_id, 1, 1, CURRENT_DATE, 1);
    RETURN;
  END IF;

  -- 어제였으면 streak 증가
  IF v_last_active = CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := v_current_streak + 1;
    IF v_current_streak > v_max_streak THEN
      v_max_streak := v_current_streak;
    END IF;
  -- 오늘이 아니면 streak 리셋
  ELSIF v_last_active < CURRENT_DATE - INTERVAL '1 day' THEN
    v_current_streak := 1;
  END IF;
  -- 오늘이면 변화 없음

  UPDATE user_journey_stats
  SET
    current_streak_days = v_current_streak,
    max_streak_days = v_max_streak,
    last_active_date = CURRENT_DATE,
    days_active = days_active + CASE WHEN v_last_active = CURRENT_DATE THEN 0 ELSE 1 END,
    updated_at = NOW()
  WHERE user_id = p_user_id AND persona_id = p_persona_id;
END;
$$ LANGUAGE plpgsql;

-- 6. 호감도 업데이트 (with stage transition)
CREATE OR REPLACE FUNCTION update_affection(
  p_user_id UUID,
  p_persona_id TEXT,
  p_change INTEGER
)
RETURNS TABLE(new_affection INTEGER, new_stage TEXT, stage_changed BOOLEAN) AS $$
DECLARE
  v_current_affection INTEGER;
  v_current_stage TEXT;
  v_new_affection INTEGER;
  v_new_stage TEXT;
BEGIN
  SELECT affection, relationship_stage
  INTO v_current_affection, v_current_stage
  FROM user_persona_relationships
  WHERE user_id = p_user_id AND persona_id = p_persona_id;

  IF NOT FOUND THEN
    -- 관계 생성
    INSERT INTO user_persona_relationships (user_id, persona_id, affection, relationship_stage)
    VALUES (p_user_id, p_persona_id, GREATEST(0, LEAST(100, p_change)), 'stranger');

    RETURN QUERY SELECT GREATEST(0, LEAST(100, p_change)), 'stranger'::TEXT, FALSE;
    RETURN;
  END IF;

  -- 호감도 계산 (0-100 범위)
  v_new_affection := GREATEST(0, LEAST(100, v_current_affection + p_change));

  -- 관계 단계 결정
  v_new_stage := CASE
    WHEN v_new_affection >= 90 THEN 'lover'
    WHEN v_new_affection >= 70 THEN 'intimate'
    WHEN v_new_affection >= 50 THEN 'close'
    WHEN v_new_affection >= 30 THEN 'friend'
    WHEN v_new_affection >= 15 THEN 'acquaintance'
    ELSE 'stranger'
  END;

  -- 업데이트
  UPDATE user_persona_relationships
  SET
    affection = v_new_affection,
    relationship_stage = v_new_stage,
    updated_at = NOW()
  WHERE user_id = p_user_id AND persona_id = p_persona_id;

  -- 호감도 변화 통계 업데이트
  UPDATE user_journey_stats
  SET
    total_affection_gained = total_affection_gained + CASE WHEN p_change > 0 THEN p_change ELSE 0 END,
    total_affection_lost = total_affection_lost + CASE WHEN p_change < 0 THEN ABS(p_change) ELSE 0 END,
    max_affection_reached = GREATEST(max_affection_reached, v_new_affection),
    affection_changes_count = affection_changes_count + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id AND persona_id = p_persona_id;

  RETURN QUERY SELECT v_new_affection, v_new_stage, (v_new_stage != v_current_stage);
END;
$$ LANGUAGE plpgsql;

-- 7. 유저-페르소나 관계 초기화 (해금 시)
CREATE OR REPLACE FUNCTION unlock_persona(p_user_id UUID, p_persona_id TEXT)
RETURNS void AS $$
BEGIN
  INSERT INTO user_persona_relationships (
    user_id,
    persona_id,
    affection,
    relationship_stage,
    is_unlocked,
    unlocked_at,
    first_interaction_at
  )
  VALUES (
    p_user_id,
    p_persona_id,
    0,
    'stranger',
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, persona_id)
  DO UPDATE SET
    is_unlocked = TRUE,
    unlocked_at = COALESCE(user_persona_relationships.unlocked_at, NOW()),
    updated_at = NOW();

  -- 여정 통계 초기화
  INSERT INTO user_journey_stats (user_id, persona_id)
  VALUES (p_user_id, p_persona_id)
  ON CONFLICT (user_id, persona_id) DO NOTHING;

  -- 이벤트 상태 초기화
  INSERT INTO user_event_state (user_id, persona_id)
  VALUES (p_user_id, p_persona_id)
  ON CONFLICT (user_id, persona_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 8. 안전한 increment (generic)
CREATE OR REPLACE FUNCTION safe_increment(current_val INTEGER, increment_by INTEGER DEFAULT 1)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(current_val, 0) + increment_by;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
