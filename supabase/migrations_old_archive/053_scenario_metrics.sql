-- ============================================
-- 시나리오 메트릭스 시스템
-- 완료율, 선택 분포, 사용자 분석 등
-- ============================================

-- 1. 시나리오 세션 테이블 (개별 플레이 세션 추적)
CREATE TABLE IF NOT EXISTS scenario_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  persona_id TEXT,
  -- 세션 상태
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN (
    'started',      -- 시작됨
    'in_progress',  -- 진행 중
    'completed',    -- 완료
    'abandoned'     -- 이탈
  )),
  -- 시간 추적
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- 진행 상황
  current_scene_id TEXT,
  current_scene_index INTEGER DEFAULT 0,
  total_scenes INTEGER,
  -- 선택 기록
  choices_made JSONB DEFAULT '[]'::jsonb,
  -- 세션 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb,
  -- 디바이스/플랫폼 정보 (분석용)
  user_agent TEXT,
  platform TEXT,
  -- 세션 시간 (초)
  duration_seconds INTEGER
);

-- 2. 씬별 진입 통계
CREATE TABLE IF NOT EXISTS scenario_scene_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  scene_index INTEGER NOT NULL,
  -- 카운터
  view_count INTEGER DEFAULT 0,
  unique_user_count INTEGER DEFAULT 0,
  -- 평균 체류 시간 (밀리초)
  avg_time_spent_ms INTEGER DEFAULT 0,
  total_time_spent_ms BIGINT DEFAULT 0,
  -- 이탈율 (이 씬에서 이탈한 비율)
  drop_off_count INTEGER DEFAULT 0,
  -- 마지막 업데이트
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id, scene_id)
);

-- 3. 선택지 통계
CREATE TABLE IF NOT EXISTS scenario_choice_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  choice_text TEXT,
  -- 선택 카운터
  selection_count INTEGER DEFAULT 0,
  unique_user_count INTEGER DEFAULT 0,
  -- 프리미엄 선택지인 경우
  is_premium BOOLEAN DEFAULT false,
  premium_conversion_count INTEGER DEFAULT 0,
  -- 호감도 변화
  affection_change INTEGER DEFAULT 0,
  -- 마지막 업데이트
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id, scene_id, choice_id)
);

-- 4. 시나리오 일별 통계 (집계 테이블)
CREATE TABLE IF NOT EXISTS scenario_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL,
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- 세션 카운터
  total_sessions INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  -- 완료 통계
  completed_sessions INTEGER DEFAULT 0,
  abandoned_sessions INTEGER DEFAULT 0,
  -- 평균 진행률 (0-100)
  avg_progress_percent NUMERIC(5,2) DEFAULT 0,
  -- 평균 완료 시간 (초)
  avg_completion_time_seconds INTEGER DEFAULT 0,
  -- 선택지 통계
  total_choices_made INTEGER DEFAULT 0,
  premium_choices_made INTEGER DEFAULT 0,
  -- 보상 통계
  total_rewards_granted INTEGER DEFAULT 0,
  -- 호감도 변화 합계
  total_affection_gained INTEGER DEFAULT 0,
  -- 마지막 업데이트
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id, stat_date)
);

-- 5. 사용자별 시나리오 진행 상태
CREATE TABLE IF NOT EXISTS user_scenario_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id TEXT NOT NULL,
  persona_id TEXT,
  -- 완료 상태
  is_completed BOOLEAN DEFAULT false,
  completion_count INTEGER DEFAULT 0,
  -- 최고 진행률
  best_progress_percent NUMERIC(5,2) DEFAULT 0,
  -- 시간 기록
  first_started_at TIMESTAMPTZ,
  first_completed_at TIMESTAMPTZ,
  last_played_at TIMESTAMPTZ,
  total_play_time_seconds INTEGER DEFAULT 0,
  -- 선택 히스토리 (최근 플레이)
  last_choices_made JSONB DEFAULT '[]'::jsonb,
  -- 획득한 보상 요약
  rewards_claimed JSONB DEFAULT '[]'::jsonb,

  UNIQUE(user_id, scenario_id)
);

-- ============================================
-- 인덱스 생성
-- ============================================

CREATE INDEX IF NOT EXISTS idx_scenario_sessions_user
  ON scenario_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_sessions_scenario
  ON scenario_sessions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_sessions_status
  ON scenario_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scenario_sessions_started
  ON scenario_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_scenario_daily_stats_date
  ON scenario_daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_scenario_daily_stats_scenario
  ON scenario_daily_stats(scenario_id);

CREATE INDEX IF NOT EXISTS idx_user_scenario_progress_user
  ON user_scenario_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scenario_progress_scenario
  ON user_scenario_progress(scenario_id);

-- ============================================
-- 세션 시작 함수
-- ============================================

CREATE OR REPLACE FUNCTION start_scenario_session(
  p_user_id UUID,
  p_scenario_id TEXT,
  p_persona_id TEXT DEFAULT NULL,
  p_total_scenes INTEGER DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- 새 세션 생성
  INSERT INTO scenario_sessions (
    user_id, scenario_id, persona_id, total_scenes,
    user_agent, platform
  ) VALUES (
    p_user_id, p_scenario_id, p_persona_id, p_total_scenes,
    p_user_agent, p_platform
  ) RETURNING id INTO v_session_id;

  -- 사용자 진행 상태 업데이트/생성
  INSERT INTO user_scenario_progress (
    user_id, scenario_id, persona_id, first_started_at, last_played_at
  ) VALUES (
    p_user_id, p_scenario_id, p_persona_id, NOW(), NOW()
  )
  ON CONFLICT (user_id, scenario_id)
  DO UPDATE SET
    last_played_at = NOW(),
    persona_id = COALESCE(p_persona_id, user_scenario_progress.persona_id);

  -- 일별 통계 업데이트
  INSERT INTO scenario_daily_stats (scenario_id, stat_date, total_sessions, unique_users)
  VALUES (p_scenario_id, CURRENT_DATE, 1, 1)
  ON CONFLICT (scenario_id, stat_date)
  DO UPDATE SET
    total_sessions = scenario_daily_stats.total_sessions + 1,
    unique_users = (
      SELECT COUNT(DISTINCT user_id)
      FROM scenario_sessions
      WHERE scenario_id = p_scenario_id
        AND started_at::date = CURRENT_DATE
    ),
    updated_at = NOW();

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 씬 진입 기록 함수
-- ============================================

CREATE OR REPLACE FUNCTION record_scene_view(
  p_session_id UUID,
  p_scene_id TEXT,
  p_scene_index INTEGER,
  p_time_spent_ms INTEGER DEFAULT 0
) RETURNS void AS $$
DECLARE
  v_scenario_id TEXT;
  v_user_id UUID;
BEGIN
  -- 세션 정보 조회
  SELECT scenario_id, user_id INTO v_scenario_id, v_user_id
  FROM scenario_sessions WHERE id = p_session_id;

  IF v_scenario_id IS NULL THEN
    RETURN;
  END IF;

  -- 세션 업데이트
  UPDATE scenario_sessions
  SET
    current_scene_id = p_scene_id,
    current_scene_index = p_scene_index,
    last_activity_at = NOW(),
    status = 'in_progress'
  WHERE id = p_session_id;

  -- 씬 통계 업데이트
  INSERT INTO scenario_scene_stats (
    scenario_id, scene_id, scene_index, view_count, unique_user_count,
    total_time_spent_ms, avg_time_spent_ms
  ) VALUES (
    v_scenario_id, p_scene_id, p_scene_index, 1, 1,
    p_time_spent_ms, p_time_spent_ms
  )
  ON CONFLICT (scenario_id, scene_id)
  DO UPDATE SET
    view_count = scenario_scene_stats.view_count + 1,
    total_time_spent_ms = scenario_scene_stats.total_time_spent_ms + p_time_spent_ms,
    avg_time_spent_ms = (scenario_scene_stats.total_time_spent_ms + p_time_spent_ms) / (scenario_scene_stats.view_count + 1),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 선택지 기록 함수
-- ============================================

CREATE OR REPLACE FUNCTION record_choice_made(
  p_session_id UUID,
  p_scene_id TEXT,
  p_choice_id TEXT,
  p_choice_text TEXT DEFAULT NULL,
  p_is_premium BOOLEAN DEFAULT false,
  p_affection_change INTEGER DEFAULT 0
) RETURNS void AS $$
DECLARE
  v_scenario_id TEXT;
  v_user_id UUID;
  v_choices JSONB;
BEGIN
  -- 세션 정보 조회
  SELECT scenario_id, user_id, choices_made INTO v_scenario_id, v_user_id, v_choices
  FROM scenario_sessions WHERE id = p_session_id;

  IF v_scenario_id IS NULL THEN
    RETURN;
  END IF;

  -- 선택 기록 추가
  v_choices := v_choices || jsonb_build_object(
    'scene_id', p_scene_id,
    'choice_id', p_choice_id,
    'choice_text', p_choice_text,
    'is_premium', p_is_premium,
    'affection_change', p_affection_change,
    'timestamp', NOW()
  );

  UPDATE scenario_sessions
  SET
    choices_made = v_choices,
    last_activity_at = NOW()
  WHERE id = p_session_id;

  -- 선택지 통계 업데이트
  INSERT INTO scenario_choice_stats (
    scenario_id, scene_id, choice_id, choice_text,
    selection_count, unique_user_count, is_premium,
    premium_conversion_count, affection_change
  ) VALUES (
    v_scenario_id, p_scene_id, p_choice_id, p_choice_text,
    1, 1, p_is_premium,
    CASE WHEN p_is_premium THEN 1 ELSE 0 END,
    p_affection_change
  )
  ON CONFLICT (scenario_id, scene_id, choice_id)
  DO UPDATE SET
    selection_count = scenario_choice_stats.selection_count + 1,
    premium_conversion_count = scenario_choice_stats.premium_conversion_count +
      CASE WHEN p_is_premium THEN 1 ELSE 0 END,
    updated_at = NOW();

  -- 일별 통계 업데이트
  UPDATE scenario_daily_stats
  SET
    total_choices_made = total_choices_made + 1,
    premium_choices_made = premium_choices_made + CASE WHEN p_is_premium THEN 1 ELSE 0 END,
    total_affection_gained = total_affection_gained + COALESCE(p_affection_change, 0),
    updated_at = NOW()
  WHERE scenario_id = v_scenario_id AND stat_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 세션 완료 함수
-- ============================================

CREATE OR REPLACE FUNCTION complete_scenario_session(
  p_session_id UUID
) RETURNS void AS $$
DECLARE
  v_scenario_id TEXT;
  v_user_id UUID;
  v_started_at TIMESTAMPTZ;
  v_duration INTEGER;
  v_choices JSONB;
  v_total_scenes INTEGER;
  v_current_index INTEGER;
BEGIN
  -- 세션 정보 조회
  SELECT
    scenario_id, user_id, started_at, choices_made,
    total_scenes, current_scene_index
  INTO
    v_scenario_id, v_user_id, v_started_at, v_choices,
    v_total_scenes, v_current_index
  FROM scenario_sessions WHERE id = p_session_id;

  IF v_scenario_id IS NULL THEN
    RETURN;
  END IF;

  -- 소요 시간 계산
  v_duration := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;

  -- 세션 완료 처리
  UPDATE scenario_sessions
  SET
    status = 'completed',
    completed_at = NOW(),
    duration_seconds = v_duration
  WHERE id = p_session_id;

  -- 사용자 진행 상태 업데이트
  UPDATE user_scenario_progress
  SET
    is_completed = true,
    completion_count = completion_count + 1,
    best_progress_percent = 100,
    first_completed_at = COALESCE(first_completed_at, NOW()),
    last_played_at = NOW(),
    total_play_time_seconds = total_play_time_seconds + v_duration,
    last_choices_made = v_choices
  WHERE user_id = v_user_id AND scenario_id = v_scenario_id;

  -- 일별 통계 업데이트
  UPDATE scenario_daily_stats
  SET
    completed_sessions = completed_sessions + 1,
    avg_completion_time_seconds = (
      (avg_completion_time_seconds * (completed_sessions - 1) + v_duration) / completed_sessions
    ),
    avg_progress_percent = (
      SELECT AVG(
        CASE
          WHEN status = 'completed' THEN 100
          ELSE (current_scene_index::NUMERIC / NULLIF(total_scenes, 0) * 100)
        END
      )
      FROM scenario_sessions
      WHERE scenario_id = v_scenario_id AND started_at::date = CURRENT_DATE
    ),
    updated_at = NOW()
  WHERE scenario_id = v_scenario_id AND stat_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 세션 이탈 처리 함수
-- ============================================

CREATE OR REPLACE FUNCTION abandon_scenario_session(
  p_session_id UUID
) RETURNS void AS $$
DECLARE
  v_scenario_id TEXT;
  v_user_id UUID;
  v_started_at TIMESTAMPTZ;
  v_duration INTEGER;
  v_current_scene_id TEXT;
  v_current_index INTEGER;
  v_total_scenes INTEGER;
  v_progress_percent NUMERIC;
BEGIN
  -- 세션 정보 조회
  SELECT
    scenario_id, user_id, started_at,
    current_scene_id, current_scene_index, total_scenes
  INTO
    v_scenario_id, v_user_id, v_started_at,
    v_current_scene_id, v_current_index, v_total_scenes
  FROM scenario_sessions WHERE id = p_session_id;

  IF v_scenario_id IS NULL THEN
    RETURN;
  END IF;

  -- 소요 시간 계산
  v_duration := EXTRACT(EPOCH FROM (NOW() - v_started_at))::INTEGER;

  -- 진행률 계산
  v_progress_percent := CASE
    WHEN v_total_scenes > 0 THEN (v_current_index::NUMERIC / v_total_scenes * 100)
    ELSE 0
  END;

  -- 세션 이탈 처리
  UPDATE scenario_sessions
  SET
    status = 'abandoned',
    duration_seconds = v_duration
  WHERE id = p_session_id;

  -- 이탈 씬 통계 업데이트
  IF v_current_scene_id IS NOT NULL THEN
    UPDATE scenario_scene_stats
    SET drop_off_count = drop_off_count + 1
    WHERE scenario_id = v_scenario_id AND scene_id = v_current_scene_id;
  END IF;

  -- 사용자 진행 상태 업데이트
  UPDATE user_scenario_progress
  SET
    best_progress_percent = GREATEST(best_progress_percent, v_progress_percent),
    last_played_at = NOW(),
    total_play_time_seconds = total_play_time_seconds + v_duration
  WHERE user_id = v_user_id AND scenario_id = v_scenario_id;

  -- 일별 통계 업데이트
  UPDATE scenario_daily_stats
  SET
    abandoned_sessions = abandoned_sessions + 1,
    avg_progress_percent = (
      SELECT AVG(
        CASE
          WHEN status = 'completed' THEN 100
          ELSE (current_scene_index::NUMERIC / NULLIF(total_scenes, 0) * 100)
        END
      )
      FROM scenario_sessions
      WHERE scenario_id = v_scenario_id AND started_at::date = CURRENT_DATE
    ),
    updated_at = NOW()
  WHERE scenario_id = v_scenario_id AND stat_date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 시나리오 통계 조회 함수
-- ============================================

CREATE OR REPLACE FUNCTION get_scenario_stats(
  p_scenario_id TEXT,
  p_days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'overview', (
      SELECT jsonb_build_object(
        'total_sessions', COALESCE(SUM(total_sessions), 0),
        'unique_users', COALESCE(SUM(unique_users), 0),
        'completed_sessions', COALESCE(SUM(completed_sessions), 0),
        'abandoned_sessions', COALESCE(SUM(abandoned_sessions), 0),
        'completion_rate', CASE
          WHEN SUM(total_sessions) > 0
          THEN ROUND(SUM(completed_sessions)::NUMERIC / SUM(total_sessions) * 100, 2)
          ELSE 0
        END,
        'avg_progress_percent', ROUND(AVG(avg_progress_percent), 2),
        'avg_completion_time_seconds', ROUND(AVG(avg_completion_time_seconds)),
        'total_choices_made', COALESCE(SUM(total_choices_made), 0),
        'premium_choices_made', COALESCE(SUM(premium_choices_made), 0),
        'total_affection_gained', COALESCE(SUM(total_affection_gained), 0)
      )
      FROM scenario_daily_stats
      WHERE scenario_id = p_scenario_id
        AND stat_date >= CURRENT_DATE - p_days
    ),
    'daily_stats', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', stat_date,
          'sessions', total_sessions,
          'completed', completed_sessions,
          'abandoned', abandoned_sessions,
          'completion_rate', CASE
            WHEN total_sessions > 0
            THEN ROUND(completed_sessions::NUMERIC / total_sessions * 100, 2)
            ELSE 0
          END
        ) ORDER BY stat_date DESC
      ), '[]'::jsonb)
      FROM scenario_daily_stats
      WHERE scenario_id = p_scenario_id
        AND stat_date >= CURRENT_DATE - p_days
    ),
    'choice_distribution', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'scene_id', scene_id,
          'choice_id', choice_id,
          'choice_text', choice_text,
          'selection_count', selection_count,
          'is_premium', is_premium,
          'selection_percentage', ROUND(
            selection_count::NUMERIC / NULLIF((
              SELECT SUM(selection_count)
              FROM scenario_choice_stats cs2
              WHERE cs2.scenario_id = cs.scenario_id AND cs2.scene_id = cs.scene_id
            ), 0) * 100, 2
          )
        )
      ), '[]'::jsonb)
      FROM scenario_choice_stats cs
      WHERE scenario_id = p_scenario_id
      ORDER BY scene_id, selection_count DESC
    ),
    'drop_off_points', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'scene_id', scene_id,
          'scene_index', scene_index,
          'drop_off_count', drop_off_count,
          'drop_off_rate', ROUND(
            drop_off_count::NUMERIC / NULLIF(view_count, 0) * 100, 2
          )
        ) ORDER BY drop_off_count DESC
      ), '[]'::jsonb)
      FROM scenario_scene_stats
      WHERE scenario_id = p_scenario_id AND drop_off_count > 0
      LIMIT 10
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS 정책
-- ============================================

ALTER TABLE scenario_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scenario_progress ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 세션만 조회/수정 가능
CREATE POLICY scenario_sessions_user_policy ON scenario_sessions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY user_scenario_progress_user_policy ON user_scenario_progress
  FOR ALL USING (user_id = auth.uid());

-- 관리자는 모든 데이터 접근 가능 (통계 조회용)
CREATE POLICY scenario_sessions_admin_policy ON scenario_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY user_scenario_progress_admin_policy ON user_scenario_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
