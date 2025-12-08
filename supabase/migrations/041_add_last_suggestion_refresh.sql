-- ============================================
-- users 테이블에 마지막 추천 새로고침 시간 컬럼 추가
-- 무료 새로고침 쿨다운 체크용
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_suggestion_refresh_at TIMESTAMPTZ;

-- 인덱스 (필요시)
CREATE INDEX IF NOT EXISTS idx_users_last_suggestion_refresh ON users(last_suggestion_refresh_at);
