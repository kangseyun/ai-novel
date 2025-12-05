-- ============================================
-- persona_core 테이블에 UI 필드 추가
-- personas 테이블 통합을 위한 1단계
-- ============================================

-- UI 표시용 필드 추가
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS followers_count TEXT DEFAULT '0';
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS posts_count INTEGER DEFAULT 0;
ALTER TABLE persona_core ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT '{}';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_persona_core_is_active ON persona_core(is_active);
CREATE INDEX IF NOT EXISTS idx_persona_core_category ON persona_core(category);
CREATE INDEX IF NOT EXISTS idx_persona_core_sort_order ON persona_core(sort_order);
