-- ============================================
-- Admin이 모든 유저를 조회할 수 있는 RLS 정책
-- ============================================

-- admin 역할을 가진 유저가 모든 users 레코드를 SELECT할 수 있도록 허용
CREATE POLICY "Admins can view all users"
ON users
FOR SELECT
TO authenticated
USING (
  -- 자기 자신이거나
  auth.uid() = id
  OR
  -- admin 역할인 경우 모든 유저 조회 가능
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 기존에 "Users can view own data" 같은 정책이 있다면
-- 위 정책과 충돌할 수 있으므로, 기존 정책을 먼저 삭제해야 할 수 있음
-- DROP POLICY IF EXISTS "Users can view own data" ON users;
