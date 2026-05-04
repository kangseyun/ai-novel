-- ============================================================================
-- 020_lock_down_definer_functions.sql
-- Resolve advisor WARNs:
--   - function_search_path_mutable (47 functions): pin search_path
--   - anon/authenticated_security_definer_function_executable (4 functions):
--     revoke RPC reach where it isn't needed; move public.is_admin to a
--     private schema so it can't be invoked via PostgREST while still being
--     callable from RLS policies.
--
-- Idempotent.
-- ============================================================================

-- 1) Pin search_path on every flagged function. Looked up dynamically by
--    name + identity args so signatures are guaranteed to match.
DO $$
DECLARE
  r RECORD;
  fn_names text[] := ARRAY[
    'update_memory_searchable_text','copy_default_memory_types','get_persona_memory_types',
    'increment_memory_reference','update_memory_embeddings','set_message_read_status',
    'get_unread_counts','get_total_unread_count','mark_messages_as_read','set_updated_at',
    'handle_new_auth_user','deduct_tokens','add_tokens','check_daily_streak',
    'claim_referral_reward','safe_increment','update_persona_published_at',
    'set_single_current_image','get_full_persona_config','get_persona_example_dialogues',
    'calculate_relationship_stage','get_relationship_stage_config','update_affection',
    'unlock_persona','update_relationship_stats','update_journey_stats','update_streak',
    'check_and_record_milestones','search_memories_semantic','search_memories_hybrid',
    'search_lore_semantic','search_conversation_memories','search_all_context',
    'start_scenario_session','record_scene_view','record_choice_made',
    'complete_scenario_session','abandon_scenario_session','grant_scenario_reward',
    'get_scenario_stats','increment_events_today','evaluate_trigger_conditions',
    'get_active_triggers_for_context','check_conflict_cooldown','increment_user_usage',
    'cleanup_old_usage_records','bump_group_room_on_message','mark_group_messages_read'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, p.proname AS fn,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = ANY(fn_names)
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      r.sch, r.fn, r.args
    );
  END LOOP;
END$$;

-- 2) handle_new_auth_user is an auth.users INSERT trigger — never an RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- 3) check_daily_streak / claim_referral_reward are app-internal RPCs;
--    keep authenticated, drop anon. Also revoke PUBLIC because every role
--    (including anon) inherits EXECUTE through PUBLIC by default.
REVOKE EXECUTE ON FUNCTION public.check_daily_streak(uuid)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_referral_reward(uuid, text)     FROM PUBLIC, anon;

-- 4) Move is_admin into the private schema so PostgREST cannot expose it
--    as /rest/v1/rpc/is_admin, while RLS policies in public can still call
--    it (PostgREST default config exposes only the public schema).
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = uid AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;

-- Re-point the policy to the private version, then drop the public copy.
DROP POLICY IF EXISTS "users_self_select" ON public.users;
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.is_admin(uuid);
