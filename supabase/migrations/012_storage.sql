-- ============================================================================
-- 012_storage.sql
-- Supabase Storage buckets used by the app:
--   persona-images   — public read, service-role write
--   user-avatars     — public read, owner write
--   marketing-images — public read, service-role write
--   group-chat-media — public read, service-role write (LUMIN group rooms)
--
-- Consolidates legacy migrations: 010 (persona-images, user-avatars),
-- 033_marketing_images_storage.sql (marketing-images).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Buckets
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('persona-images',   'persona-images',   true,  5242880,
     ARRAY['image/png','image/jpeg','image/webp','image/gif']),
  ('user-avatars',     'user-avatars',     true,  2097152,
     ARRAY['image/png','image/jpeg','image/webp']),
  ('marketing-images', 'marketing-images', true,  52428800,
     ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif']),
  ('group-chat-media', 'group-chat-media', true,  10485760,
     ARRAY['image/png','image/jpeg','image/webp','audio/mpeg','audio/mp4','audio/wav'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Public-read policies (one per bucket — drop-then-create for idempotency)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for persona images"   ON storage.objects;
CREATE POLICY "Public read access for persona images" ON storage.objects
  FOR SELECT USING (bucket_id = 'persona-images');

DROP POLICY IF EXISTS "Public read access for user avatars"     ON storage.objects;
CREATE POLICY "Public read access for user avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');

DROP POLICY IF EXISTS "Public read access for marketing images" ON storage.objects;
CREATE POLICY "Public read access for marketing images" ON storage.objects
  FOR SELECT USING (bucket_id = 'marketing-images');

DROP POLICY IF EXISTS "Public read access for group chat media" ON storage.objects;
CREATE POLICY "Public read access for group chat media" ON storage.objects
  FOR SELECT USING (bucket_id = 'group-chat-media');

-- ----------------------------------------------------------------------------
-- Write policies
-- ----------------------------------------------------------------------------
-- persona-images: service role only
DROP POLICY IF EXISTS "Service role can upload persona images"  ON storage.objects;
CREATE POLICY "Service role can upload persona images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'persona-images' AND auth.role() = 'service_role'
  );

-- user-avatars: each user uploads/deletes their own (folder == auth.uid())
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- marketing-images: service role for write/delete/update
DROP POLICY IF EXISTS "Service role can upload marketing images" ON storage.objects;
CREATE POLICY "Service role can upload marketing images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'marketing-images');

DROP POLICY IF EXISTS "Service role can delete marketing images" ON storage.objects;
CREATE POLICY "Service role can delete marketing images" ON storage.objects
  FOR DELETE USING (bucket_id = 'marketing-images');

DROP POLICY IF EXISTS "Service role can update marketing images" ON storage.objects;
CREATE POLICY "Service role can update marketing images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'marketing-images');

-- group-chat-media: service role write
DROP POLICY IF EXISTS "Service role can upload group media" ON storage.objects;
CREATE POLICY "Service role can upload group media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'group-chat-media' AND auth.role() = 'service_role'
  );
