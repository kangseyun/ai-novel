-- ============================================
-- 마케팅 이미지 Storage 버킷 생성
-- ============================================

-- marketing-images 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketing-images',
  'marketing-images',
  true,
  52428800, -- 50MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 공개 읽기 정책
CREATE POLICY "Public read access for marketing images"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketing-images');

-- 서비스 역할로 업로드 허용
CREATE POLICY "Service role can upload marketing images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'marketing-images');

-- 서비스 역할로 삭제 허용
CREATE POLICY "Service role can delete marketing images"
ON storage.objects FOR DELETE
USING (bucket_id = 'marketing-images');

-- 서비스 역할로 업데이트 허용
CREATE POLICY "Service role can update marketing images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'marketing-images');
