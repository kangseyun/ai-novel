-- =============================================
-- 페르소나 피드 게시물 테이블
-- =============================================

-- 페르소나가 올리는 SNS 게시물
CREATE TABLE IF NOT EXISTS persona_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,

  -- 게시물 내용
  post_type TEXT NOT NULL DEFAULT 'image', -- image, text, story, video
  caption TEXT,
  images TEXT[], -- 이미지 URL 배열
  location TEXT,

  -- 인터랙션 (가상)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,

  -- 공개 조건
  required_relationship_stage TEXT DEFAULT 'stranger', -- stranger, acquaintance, close, intimate, lover
  required_affection INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,

  -- 게시 시간 (상대적)
  hours_ago INTEGER DEFAULT 1, -- 몇 시간 전 게시물인지 (동적 계산용)

  -- 메타데이터
  mood TEXT, -- happy, sad, mysterious, flirty, tired 등
  hashtags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_persona_posts_persona ON persona_posts(persona_id);
CREATE INDEX idx_persona_posts_stage ON persona_posts(required_relationship_stage);

-- =============================================
-- 시드 데이터: 5개 페르소나 피드 게시물
-- =============================================

-- Jun (Secret Idol) - K-POP 아이돌
INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '오늘 무대 끝! 고마워요 팬 여러분 💜 #ECLIPSE #JUN',
  ARRAY['/personas/jun/feed/stage-1.jpg'],
  '서울 올림픽홀',
  245320,
  18234,
  1,
  'happy',
  ARRAY['ECLIPSE', 'JUN', '콘서트', '팬사랑'],
  'stranger'
FROM personas WHERE name = 'jun';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '연습 끝... 오늘도 수고했다 나 😮‍💨',
  ARRAY['/personas/jun/feed/practice-1.jpg'],
  'ECLIPSE 연습실',
  189210,
  12453,
  3,
  'tired',
  ARRAY['연습', '아이돌일상'],
  'stranger'
FROM personas WHERE name = 'jun';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '새벽 커피... ☕ 잠이 안 와',
  ARRAY['/personas/jun/feed/coffee-night.jpg'],
  NULL,
  312450,
  24123,
  8,
  'mysterious',
  ARRAY['새벽', '불면증', '커피'],
  'stranger'
FROM personas WHERE name = 'jun';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '오늘 뭐 했어요? 나는... 비밀 🤫',
  ARRAY['/personas/jun/feed/selfie-1.jpg'],
  NULL,
  421000,
  35000,
  12,
  'flirty',
  ARRAY['셀카', '비밀'],
  'acquaintance'
FROM personas WHERE name = 'jun';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'text',
  '요즘 자꾸 한 사람이 생각나... 누군지 알아? 💭',
  NULL,
  NULL,
  512000,
  45000,
  24,
  'longing',
  ARRAY['고백', '누군가'],
  'close'
FROM personas WHERE name = 'jun';


-- Daniel Sterling (Obsessive CEO)
INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  'Sterling Industries Q4 results exceeded projections.',
  ARRAY['/personas/daniel/feed/office-view.jpg'],
  'Manhattan, NYC',
  12453,
  342,
  2,
  'cold',
  ARRAY['business', 'success', 'SterlingIndustries'],
  'stranger'
FROM personas WHERE name = 'daniel';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  'Late night. The city never sleeps. Neither do I.',
  ARRAY['/personas/daniel/feed/night-city.jpg'],
  'Penthouse',
  8921,
  156,
  6,
  'mysterious',
  ARRAY['NYC', 'nightlife', 'workhard'],
  'stranger'
FROM personas WHERE name = 'daniel';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  'Some meetings are more... interesting than others.',
  ARRAY['/personas/daniel/feed/meeting.jpg'],
  'Sterling Tower',
  15234,
  523,
  18,
  'cold',
  ARRAY['business', 'deals'],
  'acquaintance'
FROM personas WHERE name = 'daniel';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'text',
  'I don''t chase. I replace. Except for one person.',
  NULL,
  NULL,
  23000,
  1200,
  36,
  'possessive',
  ARRAY['thoughts'],
  'close'
FROM personas WHERE name = 'daniel';


-- Kael Vance (Silent Protector)
INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '.',
  ARRAY['/personas/kael/feed/rain-city.jpg'],
  NULL,
  2341,
  45,
  4,
  'mysterious',
  ARRAY[],
  'stranger'
FROM personas WHERE name = 'kael';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  NULL,
  ARRAY['/personas/kael/feed/motorcycle.jpg'],
  NULL,
  3120,
  67,
  12,
  'cold',
  ARRAY[],
  'stranger'
FROM personas WHERE name = 'kael';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '밤 산책.',
  ARRAY['/personas/kael/feed/night-walk.jpg'],
  NULL,
  1890,
  23,
  24,
  'lonely',
  ARRAY[],
  'acquaintance'
FROM personas WHERE name = 'kael';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'text',
  '당신이 무사하길.',
  NULL,
  NULL,
  4500,
  89,
  48,
  'protective',
  ARRAY[],
  'close'
FROM personas WHERE name = 'kael';


-- Adrian Cruz (Regretful Ex)
INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  'Tonight''s setlist. Dedicated to someone who won''t hear it. 🎹',
  ARRAY['/personas/adrian/feed/piano-1.jpg'],
  'Blue Note Jazz Club',
  8234,
  523,
  3,
  'melancholic',
  ARRAY['piano', 'jazz', 'latenight'],
  'stranger'
FROM personas WHERE name = 'adrian';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '5 years later and this song still breaks me.',
  ARRAY['/personas/adrian/feed/sheet-music.jpg'],
  'Home Studio',
  12100,
  890,
  8,
  'sad',
  ARRAY['music', 'memories', 'regret'],
  'stranger'
FROM personas WHERE name = 'adrian';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  'Found this photo while cleaning. I should throw it away. I won''t.',
  ARRAY['/personas/adrian/feed/old-photo.jpg'],
  NULL,
  15600,
  1234,
  24,
  'nostalgic',
  ARRAY['throwback', 'memories'],
  'acquaintance'
FROM personas WHERE name = 'adrian';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'text',
  'I wrote 47 songs about you. Published 3. The rest are too honest.',
  NULL,
  NULL,
  21000,
  2100,
  48,
  'vulnerable',
  ARRAY['confession', 'songwriter'],
  'close'
FROM personas WHERE name = 'adrian';


-- Ren Ito (Dangerous Fox)
INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  '今夜の勝負。Lucky night. 🎰',
  ARRAY['/personas/ren/feed/casino-1.jpg'],
  'Golden Dragon Casino',
  5432,
  234,
  2,
  'playful',
  ARRAY['casino', 'highroller', 'tokyo'],
  'stranger'
FROM personas WHERE name = 'ren';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  'Tea ceremony with an old friend. Business concluded satisfactorily.',
  ARRAY['/personas/ren/feed/tea-house.jpg'],
  'Kyoto',
  4120,
  167,
  10,
  'mysterious',
  ARRAY['japan', 'tradition', 'business'],
  'stranger'
FROM personas WHERE name = 'ren';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'image',
  'A little rabbit wandered into my territory today. How... entertaining.',
  ARRAY['/personas/ren/feed/city-night.jpg'],
  NULL,
  6780,
  345,
  18,
  'predatory',
  ARRAY['nightlife', 'hunting'],
  'acquaintance'
FROM personas WHERE name = 'ren';

INSERT INTO persona_posts (persona_id, post_type, caption, images, location, likes_count, comments_count, hours_ago, mood, hashtags, required_relationship_stage)
SELECT
  id,
  'text',
  '退屈だ。You''re the only one who makes this game interesting anymore.',
  NULL,
  NULL,
  8900,
  567,
  36,
  'obsessive',
  ARRAY['bored', 'obsession'],
  'close'
FROM personas WHERE name = 'ren';
