-- ============================================
-- 성능 최적화 인덱스
-- ============================================

-- 1. persona_memories: 활성 기억 + 중요도 정렬 조회
CREATE INDEX IF NOT EXISTS idx_persona_memories_active_importance
  ON persona_memories(user_id, persona_id, importance_score DESC)
  WHERE is_active = true;

-- 2. persona_memories: 타입별 조회
CREATE INDEX IF NOT EXISTS idx_persona_memories_type_active
  ON persona_memories(user_id, persona_id, memory_type)
  WHERE is_active = true;

-- 3. conversation_messages: 세션별 최신 메시지 조회
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_seq
  ON conversation_messages(session_id, sequence_number DESC);

-- 4. conversation_messages: 시간순 조회
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_time
  ON conversation_messages(session_id, created_at DESC);

-- 5. scheduled_events: 대기 중 이벤트 처리
CREATE INDEX IF NOT EXISTS idx_scheduled_events_pending
  ON scheduled_events(status, scheduled_for)
  WHERE status = 'pending';

-- 6. scheduled_events: 유저별 이벤트 조회
CREATE INDEX IF NOT EXISTS idx_scheduled_events_user_persona_status
  ON scheduled_events(user_id, persona_id, status);

-- 7. event_trigger_logs: 분석용 시간순 조회
CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_time
  ON event_trigger_logs(created_at DESC);

-- 8. event_trigger_logs: 유저별 트리거 이력
CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_user_time
  ON event_trigger_logs(user_id, persona_id, created_at DESC);

-- 9. user_scenario_progress: 진행 중 시나리오 조회
CREATE INDEX IF NOT EXISTS idx_scenario_progress_active
  ON user_scenario_progress(user_id, persona_id, status)
  WHERE status = 'in_progress';

-- 10. conversation_sessions: 유저별 최신 세션
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_updated
  ON conversation_sessions(user_id, updated_at DESC);

-- 11. user_persona_relationships: 해금된 페르소나
CREATE INDEX IF NOT EXISTS idx_relationships_unlocked
  ON user_persona_relationships(user_id, is_unlocked)
  WHERE is_unlocked = true;
