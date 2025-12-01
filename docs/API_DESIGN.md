# AI Novel - Backend API 설계 문서

## 기술 스택
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **LLM**: OpenRouter (Gemini 2.0 Flash)
- **TTS**: ElevenLabs
- **Payment**: Stripe
- **Analytics**: Mixpanel

---

## 1. 인증 (Authentication)

### 1.1 회원가입
```
POST /api/auth/register
```
**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "nickname": "사용자닉네임"
}
```
**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "사용자닉네임"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token"
  }
}
```

### 1.2 로그인
```
POST /api/auth/login
```
**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### 1.3 OAuth 로그인
```
POST /api/auth/oauth
```
**Request:**
```json
{
  "provider": "google" | "apple",
  "token": "oauth_token"
}
```

### 1.4 로그아웃
```
POST /api/auth/logout
```

### 1.5 토큰 갱신
```
POST /api/auth/refresh
```

---

## 2. 사용자 (User)

### 2.1 사용자 프로필 조회
```
GET /api/user/profile
```
**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "nickname": "사용자닉네임",
  "profile_image": "url",
  "bio": "자기소개",
  "gems": 500,
  "subscription": {
    "plan": "premium" | "free",
    "expires_at": "2025-12-31"
  },
  "created_at": "timestamp",
  "onboarding_completed": true
}
```

### 2.2 사용자 프로필 수정
```
PUT /api/user/profile
```
**Request:**
```json
{
  "nickname": "새닉네임",
  "profile_image": "url",
  "bio": "새 자기소개"
}
```

### 2.3 사용자 페르소나 설정 저장
```
POST /api/user/persona
```
**Request:**
```json
{
  "personality_type": "extroverted" | "introverted" | "ambivert",
  "communication_style": "direct" | "indirect" | "playful" | "serious",
  "emotional_tendency": "expressive" | "reserved" | "empathetic",
  "interests": ["음악", "영화", "게임"],
  "love_language": "words" | "time" | "gifts" | "service" | "touch",
  "attachment_style": "secure" | "anxious" | "avoidant" | "fearful"
}
```

### 2.4 온보딩 완료 처리
```
POST /api/user/onboarding/complete
```
**Request:**
```json
{
  "variant": "a" | "b" | "c",
  "persona_id": "jun",
  "affection_gained": 25,
  "choices_made": [
    { "scene_id": "scene1", "choice_id": "choice1" }
  ]
}
```

---

## 3. 페르소나 & 시나리오 (Persona & Scenario)

### 3.1 페르소나 목록 조회
```
GET /api/personas
```
**Response:**
```json
{
  "personas": [
    {
      "id": "jun",
      "name": "Jun",
      "full_name": "이준",
      "age": 22,
      "occupation": "아이돌",
      "image": "url",
      "color": "#8B5CF6",
      "teaser_line": "...잠이 안 와. 너도?",
      "available": true,
      "episode_count": 5
    }
  ]
}
```

### 3.2 페르소나 상세 조회
```
GET /api/personas/:personaId
```
**Response:**
```json
{
  "id": "jun",
  "name": "Jun",
  "full_name": "이준",
  "age": 22,
  "occupation": "아이돌 그룹 ECLIPSE 메인보컬",
  "public_personality": "완벽한 아이돌",
  "private_personality": "외로움을 느끼는 청년",
  "speech_patterns": {
    "formal": "~요, ~네요",
    "casual": "~야, ~어",
    "emotional_cues": ["...", "ㅎㅎ"]
  },
  "sns_profile": {
    "username": "@jun.eclipse",
    "followers": "2.4M",
    "bio": "ECLIPSE | Main Vocal"
  }
}
```

### 3.3 에피소드 목록 조회
```
GET /api/personas/:personaId/episodes
```
**Response:**
```json
{
  "episodes": [
    {
      "id": "ep1",
      "title": "새벽 3시, 편의점",
      "premise": "우연한 첫 만남",
      "duration_minutes": 15,
      "is_premium": false,
      "is_locked": false,
      "unlock_requirements": null,
      "thumbnail": "url"
    },
    {
      "id": "ep2",
      "title": "비밀 연락처",
      "premise": "그의 개인 번호",
      "duration_minutes": 20,
      "is_premium": true,
      "is_locked": true,
      "unlock_requirements": {
        "min_affection": 30,
        "gem_cost": 100
      }
    }
  ]
}
```

### 3.4 에피소드 시작
```
POST /api/game/episode/start
```
**Request:**
```json
{
  "persona_id": "jun",
  "episode_id": "ep1"
}
```
**Response:**
```json
{
  "session_id": "game_session_uuid",
  "episode": {
    "id": "ep1",
    "title": "새벽 3시, 편의점"
  },
  "initial_scene": {
    "id": "scene1",
    "setting": {
      "location": "편의점",
      "time": "새벽 3시",
      "mood": "고요한"
    },
    "beats": [...]
  }
}
```

---

## 4. 게임 진행 (Game Progress)

### 4.1 게임 상태 조회
```
GET /api/game/state/:personaId
```
**Response:**
```json
{
  "persona_id": "jun",
  "affection": 45,
  "relationship_stage": "friend",
  "completed_episodes": ["ep1", "ep2"],
  "unlocked_episodes": ["ep1", "ep2", "ep3"],
  "current_episode": {
    "id": "ep3",
    "scene_id": "scene2",
    "beat_index": 5
  },
  "story_flags": {
    "shared_secret": true,
    "first_hug": false
  },
  "last_interaction": "timestamp"
}
```

### 4.2 선택지 선택
```
POST /api/game/choice
```
**Request:**
```json
{
  "session_id": "game_session_uuid",
  "scene_id": "scene1",
  "beat_id": "beat3",
  "choice_id": "choice2",
  "is_premium": false
}
```
**Response:**
```json
{
  "success": true,
  "affection_change": +10,
  "new_affection": 55,
  "flags_updated": {
    "showed_concern": true
  },
  "next_beat": {
    "id": "beat4",
    "type": "dialogue",
    "speaker": "jun",
    "emotion": "touched",
    "text": "...고마워. 진심으로.",
    "tts_url": "https://..."
  },
  "stage_changed": null
}
```

### 4.3 다음 비트 요청 (자동 진행)
```
POST /api/game/next-beat
```
**Request:**
```json
{
  "session_id": "game_session_uuid"
}
```

### 4.4 에피소드 완료
```
POST /api/game/episode/complete
```
**Request:**
```json
{
  "session_id": "game_session_uuid",
  "episode_id": "ep1"
}
```
**Response:**
```json
{
  "completed": true,
  "total_affection_gained": 35,
  "new_affection": 80,
  "unlocked_items": [
    { "type": "gallery", "id": "cg_jun_smile" }
  ],
  "unlocked_episodes": ["ep2"],
  "stage_changed": {
    "from": "friend",
    "to": "close"
  }
}
```

### 4.5 게임 저장
```
POST /api/game/save
```
**Request:**
```json
{
  "persona_id": "jun",
  "slot": 1
}
```

### 4.6 게임 불러오기
```
GET /api/game/load/:personaId/:slot
```

---

## 5. LLM 연동 (OpenRouter)

### 5.1 대화 생성
```
POST /api/llm/generate-dialogue
```
**Request:**
```json
{
  "persona_id": "jun",
  "session_id": "game_session_uuid",
  "context": {
    "scene_id": "scene1",
    "beat_id": "beat5",
    "user_choice": "걱정되서 그래. 괜찮아?",
    "affection": 45,
    "relationship_stage": "friend",
    "active_flags": ["shared_secret"],
    "recent_dialogue": [
      { "speaker": "jun", "text": "..." },
      { "speaker": "user", "text": "..." }
    ]
  }
}
```
**Response:**
```json
{
  "dialogue": {
    "text": "...진짜 괜찮아. 그냥... 오늘따라 좀 그래.",
    "emotion": "vulnerable",
    "inner_thought": "이 사람은 진심으로 걱정해주는 것 같다"
  },
  "affection_modifier": +5,
  "suggested_choices": [
    {
      "id": "gen_choice_1",
      "text": "무슨 일 있어? 말해줘",
      "tone": "caring"
    },
    {
      "id": "gen_choice_2",
      "text": "그럴 때 있지. 나도 그래",
      "tone": "empathetic"
    },
    {
      "id": "gen_choice_3",
      "text": "라면이라도 먹을래?",
      "tone": "playful"
    }
  ],
  "tts_priority": "medium"
}
```

### 5.2 동적 선택지 생성
```
POST /api/llm/generate-choices
```
**Request:**
```json
{
  "persona_id": "jun",
  "context": {
    "situation": "Jun이 갑자기 연습실에서 쓰러졌다",
    "mood": "urgent",
    "affection": 60
  },
  "choice_count": 3
}
```

### 5.3 캐릭터 반응 생성 (포스트 반응)
```
POST /api/llm/generate-reaction
```
**Request:**
```json
{
  "persona_id": "jun",
  "trigger": {
    "type": "user_post",
    "content": {
      "mood": "lonely",
      "caption": "오늘 하루도 끝...",
      "time": "02:30"
    }
  },
  "affection": 50
}
```
**Response:**
```json
{
  "should_react": true,
  "reaction_type": "dm",
  "message": "야, 아직 안 자? 나도 방금 연습 끝났는데",
  "delay_seconds": 180
}
```

---

## 6. TTS (ElevenLabs)

### 6.1 음성 생성
```
POST /api/tts/generate
```
**Request:**
```json
{
  "persona_id": "jun",
  "text": "...고마워. 진심으로.",
  "emotion": "touched",
  "hook_type": "emotional_peak"
}
```
**Response:**
```json
{
  "audio_url": "https://...",
  "duration_ms": 2500,
  "cached": false
}
```

### 6.2 캐시된 음성 조회
```
GET /api/tts/cache/:hash
```

---

## 7. SNS 피드 (Feed)

### 7.1 피드 조회
```
GET /api/feed?page=1&limit=20
```
**Response:**
```json
{
  "posts": [
    {
      "id": "post_uuid",
      "type": "persona_post",
      "persona_id": "jun",
      "content": {
        "images": ["url1", "url2"],
        "caption": "오늘 무대 끝! 고마워요 팬 여러분",
        "location": "서울 올림픽홀"
      },
      "likes": 24532,
      "user_liked": false,
      "created_at": "timestamp",
      "hack_level_required": 1
    },
    {
      "id": "user_post_uuid",
      "type": "user_post",
      "content": {
        "mood": "happy",
        "caption": "오늘 기분 좋아~"
      },
      "triggered_events": ["jun_dm_1"],
      "created_at": "timestamp"
    }
  ],
  "next_page": 2
}
```

### 7.2 유저 포스트 작성
```
POST /api/feed/post
```
**Request:**
```json
{
  "type": "mood",
  "mood": "lonely",
  "caption": "새벽에 잠이 안 와...",
  "image": "base64_or_url"
}
```
**Response:**
```json
{
  "post": { ... },
  "triggered_events": [
    {
      "id": "event_uuid",
      "type": "dm_notification",
      "persona_id": "jun",
      "preview": "야, 아직 안 자?",
      "delay_seconds": 120
    }
  ]
}
```

### 7.3 포스트 좋아요
```
POST /api/feed/post/:postId/like
```

### 7.4 포스트 삭제
```
DELETE /api/feed/post/:postId
```

### 7.5 이벤트/알림 조회
```
GET /api/feed/events
```
**Response:**
```json
{
  "events": [
    {
      "id": "event_uuid",
      "type": "dm_notification",
      "persona_id": "jun",
      "title": "Jun님이 DM을 보냈습니다",
      "preview": "야, 아직 안 자?",
      "scenario_id": "dm_late_night",
      "read": false,
      "created_at": "timestamp"
    }
  ],
  "unread_count": 3
}
```

### 7.6 이벤트 읽음 처리
```
PUT /api/feed/events/:eventId/read
```

---

## 8. DM 시나리오

### 8.1 DM 목록 조회
```
GET /api/dm/list
```
**Response:**
```json
{
  "threads": [
    {
      "persona_id": "jun",
      "persona_name": "Jun",
      "persona_image": "url",
      "last_message": "내일 봐",
      "last_message_time": "timestamp",
      "unread_count": 2,
      "pinned": true
    }
  ]
}
```

### 8.2 DM 시나리오 시작
```
POST /api/dm/scenario/start
```
**Request:**
```json
{
  "persona_id": "jun",
  "scenario_id": "dm_late_night"
}
```

### 8.3 DM 메시지 전송 (선택)
```
POST /api/dm/message
```
**Request:**
```json
{
  "session_id": "dm_session_uuid",
  "choice_id": "choice1"
}
```

---

## 9. 해킹 레벨 시스템

### 9.1 해킹 상태 조회
```
GET /api/hack/status
```
**Response:**
```json
{
  "global_level": 3,
  "global_xp": 2500,
  "next_level_xp": 3000,
  "profiles": {
    "jun": {
      "level": 3,
      "xp": 1200,
      "unlocked_content": ["hidden_story_1", "secret_photo_1"]
    }
  }
}
```

### 9.2 XP 획득
```
POST /api/hack/gain-xp
```
**Request:**
```json
{
  "persona_id": "jun",
  "amount": 100,
  "source": "story_viewed"
}
```

### 9.3 숨겨진 콘텐츠 조회
```
GET /api/hack/hidden/:personaId
```
**Response:**
```json
{
  "hidden_files": [
    {
      "id": "secret_1",
      "type": "photo",
      "thumbnail": "blurred_url",
      "title": "???",
      "unlock_level": 3,
      "is_unlocked": true,
      "content_url": "url"
    }
  ],
  "hidden_stories": [...],
  "hidden_posts": [...]
}
```

---

## 10. 결제 (Payment)

### 10.1 젬 패키지 목록
```
GET /api/payment/gem-packages
```
**Response:**
```json
{
  "packages": [
    {
      "id": "starter",
      "name": "스타터 팩",
      "gems": 500,
      "price": 4.99,
      "currency": "USD",
      "bonus": 0
    },
    {
      "id": "popular",
      "name": "인기 팩",
      "gems": 1200,
      "price": 9.99,
      "currency": "USD",
      "bonus": 200
    }
  ]
}
```

### 10.2 구독 플랜 목록
```
GET /api/payment/subscriptions
```
**Response:**
```json
{
  "plans": [
    {
      "id": "premium_monthly",
      "name": "프리미엄",
      "price": 9.99,
      "interval": "month",
      "features": [
        "프리미엄 에피소드 무제한",
        "매달 500 젬 지급",
        "광고 제거"
      ]
    }
  ]
}
```

### 10.3 결제 세션 생성
```
POST /api/payment/checkout
```
**Request:**
```json
{
  "type": "gem_package" | "subscription",
  "item_id": "starter"
}
```
**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_xxx"
}
```

### 10.4 결제 확인
```
GET /api/payment/verify/:sessionId
```

### 10.5 Stripe Webhook
```
POST /api/payment/webhook
```

### 10.6 젬 사용
```
POST /api/payment/spend-gems
```
**Request:**
```json
{
  "amount": 100,
  "purpose": "unlock_episode",
  "target_id": "ep2"
}
```

---

## 11. 갤러리 & 언락 콘텐츠

### 11.1 갤러리 조회
```
GET /api/gallery/:personaId
```
**Response:**
```json
{
  "items": [
    {
      "id": "cg_jun_smile",
      "type": "cg",
      "title": "미소",
      "thumbnail": "url",
      "full_image": "url",
      "is_unlocked": true,
      "unlock_source": "ep1_complete"
    },
    {
      "id": "voice_confession",
      "type": "voice",
      "title": "???",
      "is_unlocked": false,
      "unlock_requirement": {
        "type": "affection",
        "value": 100
      }
    }
  ]
}
```

### 11.2 아이템 언락
```
POST /api/gallery/unlock
```
**Request:**
```json
{
  "item_id": "cg_jun_smile",
  "method": "gems" | "achievement"
}
```

---

## 12. 분석 (Analytics)

### 12.1 이벤트 추적
```
POST /api/analytics/event
```
**Request:**
```json
{
  "event": "scenario_completed",
  "properties": {
    "persona_id": "jun",
    "episode_id": "ep1",
    "duration_seconds": 900,
    "affection_gained": 35
  }
}
```

---

## Database Schema (Supabase)

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nickname TEXT,
  profile_image TEXT,
  bio TEXT,
  gems INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_variant TEXT
);
```

### user_personas
```sql
CREATE TABLE user_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  personality_type TEXT,
  communication_style TEXT,
  emotional_tendency TEXT,
  interests TEXT[],
  love_language TEXT,
  attachment_style TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### game_state
```sql
CREATE TABLE game_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  persona_id TEXT NOT NULL,
  affection INTEGER DEFAULT 0,
  relationship_stage TEXT DEFAULT 'stranger',
  completed_episodes TEXT[],
  unlocked_episodes TEXT[],
  story_flags JSONB DEFAULT '{}',
  current_episode TEXT,
  current_scene TEXT,
  current_beat INTEGER,
  last_interaction TIMESTAMP,
  UNIQUE(user_id, persona_id)
);
```

### conversation_history
```sql
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  persona_id TEXT NOT NULL,
  episode_id TEXT,
  scene_id TEXT,
  beat_id TEXT,
  speaker TEXT, -- 'user' | 'persona'
  content TEXT,
  emotion TEXT,
  choice_made TEXT,
  affection_change INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### user_posts
```sql
CREATE TABLE user_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT, -- 'mood' | 'photo' | 'text'
  mood TEXT,
  caption TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### feed_events
```sql
CREATE TABLE feed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT, -- 'dm_notification' | 'like' | 'comment' | 'follow'
  persona_id TEXT,
  title TEXT,
  preview TEXT,
  scenario_id TEXT,
  post_id UUID REFERENCES user_posts(id),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### hack_progress
```sql
CREATE TABLE hack_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  persona_id TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  unlocked_content TEXT[],
  viewed_stories TEXT[],
  UNIQUE(user_id, persona_id)
);
```

### unlocked_items
```sql
CREATE TABLE unlocked_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  persona_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT, -- 'cg' | 'voice' | 'document'
  unlocked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, persona_id, item_id)
);
```

### payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_session_id TEXT,
  type TEXT, -- 'gem_package' | 'subscription'
  item_id TEXT,
  amount DECIMAL,
  currency TEXT,
  status TEXT, -- 'pending' | 'completed' | 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_subscription_id TEXT,
  plan_id TEXT,
  status TEXT, -- 'active' | 'cancelled' | 'expired'
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 환경 변수

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenRouter
OPENROUTER_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Mixpanel
NEXT_PUBLIC_MIXPANEL_TOKEN=
```

---

## API 우선순위

### Phase 1 - MVP (필수)
1. 인증 (register, login, OAuth)
2. 게임 상태 저장/불러오기
3. LLM 대화 생성
4. 기본 결제

### Phase 2 - Core Features
5. SNS 피드
6. DM 시나리오
7. 해킹 레벨 시스템
8. TTS 생성

### Phase 3 - Enhancement
9. 갤러리 시스템
10. 분석/트래킹
11. 고급 결제 (구독)
