-- ============================================================================
-- 019_fix_security_definer_views.sql
-- Resolve advisor ERROR `security_definer_view` for 5 public views, and
-- WARN `public_bucket_allows_listing` for 4 storage buckets.
--
-- Views: switch to security_invoker so RLS of the *querying* user is enforced
-- instead of the view owner. Underlying tables already have appropriate
-- read policies (persona_core_read, user-scoped policies on llm_usage_records,
-- persona_memories, etc.), so end-user queries continue to work.
--
-- Storage: drop the broad SELECT policies that let any client list every
-- object in the bucket. Public buckets remain accessible by direct object
-- URL; only the LIST API surface is closed.
--
-- Idempotent.
-- ============================================================================

-- 1) Views: enforce caller's RLS, not creator's.
ALTER VIEW public.user_daily_usage         SET (security_invoker = true);
ALTER VIEW public.personas                 SET (security_invoker = true);
ALTER VIEW public.user_monthly_usage       SET (security_invoker = true);
ALTER VIEW public.memory_embedding_stats   SET (security_invoker = true);
ALTER VIEW public.user_persona_full_state  SET (security_invoker = true);

-- 2) Storage: remove "list everything" policies on public buckets.
DROP POLICY IF EXISTS "Public read access for group chat media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for marketing images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for persona images"   ON storage.objects;
DROP POLICY IF EXISTS "Public read access for user avatars"     ON storage.objects;
