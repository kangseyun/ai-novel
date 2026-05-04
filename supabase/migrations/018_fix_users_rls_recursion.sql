-- ============================================================================
-- 018_fix_users_rls_recursion.sql
-- Fix infinite recursion (42P17) in public.users SELECT policy.
--
-- Problem:
--   The "users_self_select" policy from 001_core_users.sql contains an
--   EXISTS subquery against public.users itself. Postgres re-applies the
--   same RLS policy when evaluating the subquery, causing infinite recursion.
--
-- Fix:
--   Wrap the admin lookup in a SECURITY DEFINER function so it bypasses
--   RLS, breaking the recursion. The function is also reusable by every
--   other policy that needs an admin check.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1) Admin lookup helper. SECURITY DEFINER bypasses RLS on public.users.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = uid AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- 2) Replace the recursive users_self_select policy.
DROP POLICY IF EXISTS "users_self_select" ON public.users;
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));
