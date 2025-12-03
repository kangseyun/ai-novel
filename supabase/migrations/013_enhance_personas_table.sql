-- =============================================
-- 페르소나 테이블 개선
-- =============================================

-- 1. 기존 personas 테이블에 필수 컬럼 추가
ALTER TABLE personas ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE personas ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- SNS 프로필 관련
ALTER TABLE personas ADD COLUMN IF NOT EXISTS followers_count TEXT DEFAULT '0';
ALTER TABLE personas ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS posts_count INTEGER DEFAULT 0;

-- 메타데이터
ALTER TABLE personas ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE personas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_personas_category ON personas(category);
CREATE INDEX IF NOT EXISTS idx_personas_active ON personas(is_active);
CREATE INDEX IF NOT EXISTS idx_personas_premium ON personas(is_premium);
CREATE INDEX IF NOT EXISTS idx_personas_sort ON personas(sort_order);

-- =============================================
-- 2. 기존 페르소나 데이터 업데이트
-- =============================================

-- Jun (Secret Idol)
UPDATE personas SET
  display_name = 'Jun ✧ ECLIPSE',
  username = 'jun_eclipse_official',
  bio = 'ECLIPSE Main Vocalist 🎤 | 팬 여러분 사랑해요 💜',
  avatar_url = '/images/personas/jun/profile.png',
  cover_image_url = '/images/personas/jun/cover.jpg',
  is_verified = true,
  is_active = true,
  is_premium = false,
  category = 'idol',
  sort_order = 1,
  followers_count = '8.9M',
  following_count = 127,
  posts_count = 342,
  tags = ARRAY['kpop', 'idol', 'vocal', 'romantic']
WHERE name = 'jun' OR id = 'jun';

-- Daniel Sterling (Obsessive CEO)
UPDATE personas SET
  display_name = 'Daniel Sterling',
  username = 'daniel_sterling',
  bio = 'CEO, Sterling Industries | NYC 🏙️',
  avatar_url = '/images/personas/daniel/profile.png',
  cover_image_url = '/images/personas/daniel/cover.jpg',
  is_verified = true,
  is_active = true,
  is_premium = true,
  category = 'ceo',
  sort_order = 2,
  followers_count = '2.1M',
  following_count = 43,
  posts_count = 89,
  tags = ARRAY['ceo', 'business', 'possessive', 'cold']
WHERE name = 'daniel' OR id = 'daniel';

-- Kael Vance (Silent Protector)
UPDATE personas SET
  display_name = 'Kael',
  username = 'kael_vance',
  bio = '...',
  avatar_url = '/images/personas/kael/profile.png',
  cover_image_url = '/images/personas/kael/cover.jpg',
  is_verified = false,
  is_active = true,
  is_premium = true,
  category = 'protector',
  sort_order = 3,
  followers_count = '12K',
  following_count = 3,
  posts_count = 15,
  tags = ARRAY['bodyguard', 'silent', 'protective', 'mysterious']
WHERE name = 'kael' OR id = 'kael';

-- Adrian Cruz (Regretful Ex)
UPDATE personas SET
  display_name = 'Adrian Cruz',
  username = 'adrian_cruz',
  bio = 'Jazz Pianist 🎹 | Songwriter | "The songs I can''t sing are about you"',
  avatar_url = '/images/personas/adrian/profile.png',
  cover_image_url = '/images/personas/adrian/cover.jpg',
  is_verified = true,
  is_active = true,
  is_premium = true,
  category = 'artist',
  sort_order = 4,
  followers_count = '890K',
  following_count = 234,
  posts_count = 256,
  tags = ARRAY['musician', 'ex', 'regret', 'emotional']
WHERE name = 'adrian' OR id = 'adrian';

-- Ren Ito (Dangerous Fox)
UPDATE personas SET
  display_name = '伊藤 蓮 (Ren)',
  username = 'ren_ito',
  bio = '🦊 | Tokyo | "Some games are worth dying for"',
  avatar_url = '/images/personas/ren/profile.png',
  cover_image_url = '/images/personas/ren/cover.jpg',
  is_verified = false,
  is_active = true,
  is_premium = true,
  category = 'dangerous',
  sort_order = 5,
  followers_count = '156K',
  following_count = 0,
  posts_count = 67,
  tags = ARRAY['yakuza', 'dangerous', 'playful', 'obsessive']
WHERE name = 'ren' OR id = 'ren';

-- =============================================
-- 3. 페르소나가 없으면 INSERT (안전장치)
-- =============================================

INSERT INTO personas (id, name, display_name, username, bio, avatar_url, cover_image_url, is_verified, is_active, is_premium, category, sort_order, followers_count, following_count, posts_count, tags)
VALUES
  ('jun', 'jun', 'Jun ✧ ECLIPSE', 'jun_eclipse_official', 'ECLIPSE Main Vocalist 🎤 | 팬 여러분 사랑해요 💜', '/images/personas/jun/profile.png', '/images/personas/jun/cover.jpg', true, true, false, 'idol', 1, '8.9M', 127, 342, ARRAY['kpop', 'idol', 'vocal', 'romantic']),
  ('daniel', 'daniel', 'Daniel Sterling', 'daniel_sterling', 'CEO, Sterling Industries | NYC 🏙️', '/images/personas/daniel/profile.png', '/images/personas/daniel/cover.jpg', true, true, true, 'ceo', 2, '2.1M', 43, 89, ARRAY['ceo', 'business', 'possessive', 'cold']),
  ('kael', 'kael', 'Kael', 'kael_vance', '...', '/images/personas/kael/profile.png', '/images/personas/kael/cover.jpg', false, true, true, 'protector', 3, '12K', 3, 15, ARRAY['bodyguard', 'silent', 'protective', 'mysterious']),
  ('adrian', 'adrian', 'Adrian Cruz', 'adrian_cruz', 'Jazz Pianist 🎹 | Songwriter | "The songs I can''t sing are about you"', '/images/personas/adrian/profile.png', '/images/personas/adrian/cover.jpg', true, true, true, 'artist', 4, '890K', 234, 256, ARRAY['musician', 'ex', 'regret', 'emotional']),
  ('ren', 'ren', '伊藤 蓮 (Ren)', 'ren_ito', '🦊 | Tokyo | "Some games are worth dying for"', '/images/personas/ren/profile.png', '/images/personas/ren/cover.jpg', false, true, true, 'dangerous', 5, '156K', 0, 67, ARRAY['yakuza', 'dangerous', 'playful', 'obsessive'])
ON CONFLICT (id) DO NOTHING;
