-- =============================================
-- Supabase Storage Buckets
-- =============================================

-- 페르소나 피드 이미지 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'persona-images',
  'persona-images',
  true,  -- 공개 버킷 (피드 이미지는 누구나 볼 수 있어야 함)
  5242880,  -- 5MB 제한
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 사용자 프로필 이미지 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  2097152,  -- 2MB 제한
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 페르소나 이미지 버킷 정책: 누구나 읽기 가능
CREATE POLICY "Public read access for persona images"
ON storage.objects FOR SELECT
USING (bucket_id = 'persona-images');

-- 페르소나 이미지 버킷 정책: 서비스 롤만 업로드 가능
CREATE POLICY "Service role can upload persona images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'persona-images'
  AND auth.role() = 'service_role'
);

-- 사용자 아바타 버킷 정책: 누구나 읽기 가능
CREATE POLICY "Public read access for user avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-avatars');

-- 사용자 아바타 버킷 정책: 인증된 사용자는 자신의 아바타만 업로드 가능
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 사용자 아바타 버킷 정책: 인증된 사용자는 자신의 아바타만 삭제 가능
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
