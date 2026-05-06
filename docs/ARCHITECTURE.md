# Luminovel Architecture

> 시스템 아키텍처 + 메모리/시나리오 설계 + 유저 플로우 + 튜토리얼 + 기술 개선 체크리스트

---

## 1. 핵심 개념

### 1.1 Origin vs User Instance 분리
- **Origin Persona (불변):** 콘텐츠팀이 작성한 캐릭터 데이터. 새 유저 누구든 같은 원본에서 시작
- **User Instance (가변):** 유저별로 진화하는 관계 데이터

| Layer | Tables |
|---|---|
| **Origin (불변)** | `personas`, `persona_core`, `persona_traits`, `persona_worldview`, `scenario_templates`, `event_trigger_rules`, `relationship_milestones` |
| **User Instance** | `user_persona_relationships` (또는 신규 `user_persona_progress`), `persona_memories` (또는 `user_memories`), `user_journey_stats`, `user_scenario_progress`, `scheduled_events` |
| **Interaction** | `conversation_sessions`, `conversation_messages`, `conversation_summaries` |

---

## 2. 시스템 구성도

```
Frontend (Next.js 16 App Router)
  SNS Feed │ DM Chat │ Scenario Player │ Profile │ Shop
       ↓
API Layer (/api/ai/* /api/dm/* /api/scenario/* /api/personas/*)
       ↓
AI Agent System (lib/ai-agent/)
  ┌─ AIAgent (Core) ──── LLMClient (OpenRouter) ──── PersonaLoader
  ├─ MemoryManager (semantic memory + extraction)
  ├─ ScenarioService (Static/Guided/Dynamic engines)
  ├─ EventTriggerService (relationship/time/keyword/inactivity 트리거)
  ├─ EmotionalStateTracker
  └─ ModelSelector (멀티모델 라우팅)
       ↓
Supabase (PostgreSQL + pgvector + RLS)
```

### 기술 스택
- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript (strict)
- **Styling:** Tailwind v4 + Shadcn(Radix) + Framer Motion
- **DB:** Supabase (PG + pgvector + RLS)
- **Auth:** Supabase Auth (**Google + Discord** OAuth)
- **LLM:** **OpenRouter** (multi-model via ModelSelector)
- **Voice:** ElevenLabs (멤버별 클로닝)
- **Image:** Kling AI (멤버별 외모 시드)
- **Payment:** Stripe (+ Paddle 백업)
- **Cache/Rate:** Upstash Redis
- **Analytics:** Mixpanel + Firebase + GA4 + Meta Pixel + Airbridge
- **State:** Zustand 5

---

## 3. 핵심 플로우

### 3.1 DM 대화
```
1. 유저 메시지 입력
2. /api/ai/chat 호출
3. AIAgent.processMessage()
   ├─ 세션 조회/생성
   ├─ 컨텍스트 구성 (페르소나 + 관계 + 기억)
   ├─ LLM 응답 생성 (OpenRouter)
   ├─ 메시지 저장
   ├─ 관계 상태 업데이트 (affection, stage)
   ├─ 기억 추출 및 저장 (큐 기반 비동기)
   └─ scenarioTrigger 체크
4. 응답 반환 (+ 선택지)
5. scenarioTrigger 시 시나리오 전환 모달
```

### 3.2 시나리오
```
1. DM에서 trigger OR 직접 시작
2. /scenario 페이지로 이동
3. ScenarioPlayer (씬/대화/선택지)
4. 시나리오 완료
   ├─ ScenarioService.completeScenario()
   ├─ 호감도 업데이트
   ├─ 메모리 저장 (첫만남 등)
   ├─ 마일스톤 기록
   └─ 여정 통계 업데이트
5. DM으로 복귀
```

### 3.3 이벤트 트리거 (백그라운드)
```
1. Cron/Edge Function
2. EventTriggerService.evaluateAndTrigger()
   ├─ 활성 규칙 조회
   ├─ 유저 상태 조회
   ├─ 조건 평가 + 확률 계산
   └─ 트리거 결정
3. scheduled_events에 저장 (전달 시간 설정)
4. 이벤트 전달 (푸시 / DM / 피드)
```

---

## 4. 데이터 모델 핵심 스키마

### 4.1 user_persona_progress (확장된 관계 테이블)
```sql
CREATE TABLE user_persona_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  persona_id TEXT REFERENCES personas(id),

  -- 관계 상태
  relationship_stage TEXT DEFAULT 'stranger',
    -- LUMIN 단계: stranger → fan → friend → close → heart (💗)
  affection INTEGER DEFAULT 0,        -- 0-100
  trust_level INTEGER DEFAULT 50,
  intimacy_level INTEGER DEFAULT 0,
  tension_level INTEGER DEFAULT 0,

  -- 스토리/시나리오 진행
  main_story_progress INTEGER DEFAULT 0,
  scenarios_completed TEXT[] DEFAULT '{}',
  scenarios_unlocked TEXT[] DEFAULT '{}',
  major_choices JSONB DEFAULT '[]',

  -- 해금 콘텐츠
  secrets_unlocked TEXT[],
  gallery_unlocked TEXT[],
  voice_unlocked TEXT[],

  -- 페르소나 진화 상태
  evolved_personality JSONB DEFAULT '{}',
  unlocked_sides TEXT[],
  behavior_flags JSONB DEFAULT '{}',
  current_mood TEXT DEFAULT 'neutral',

  -- 별명
  user_calls_persona TEXT,
  persona_calls_user TEXT,

  -- 통계
  total_messages INTEGER DEFAULT 0,
  total_scenarios_played INTEGER DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  longest_conversation INTEGER DEFAULT 0,

  -- 마일스톤
  milestones_achieved JSONB DEFAULT '[]',
  milestone_dates JSONB DEFAULT '{}',

  first_interaction_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  UNIQUE(user_id, persona_id)
);
```

### 4.2 user_memories
```sql
CREATE TABLE user_memories (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  persona_id TEXT REFERENCES personas(id),

  memory_type TEXT NOT NULL,
    -- 'first_meeting' / 'became_fan' / 'became_friends' / 'first_call' /
    -- 'first_date' / 'became_close' / 'first_confession' / 'became_heart' /
    -- 'first_anniversary' / 'promise' / 'secret_shared' / 'conflict' /
    -- 'reconciliation' / 'special_moment' / 'gift' / 'inside_joke'
  memory_category TEXT DEFAULT 'story',
    -- 'story' | 'dm' | 'event' | 'system'

  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_content JSONB,

  thumbnail_url TEXT,
  cg_urls TEXT[],
  voice_url TEXT,

  related_scenario_id TEXT,
  related_session_id UUID,
  triggered_by TEXT,

  emotional_impact INTEGER DEFAULT 5,
  affection_at_time INTEGER,
  affection_change INTEGER DEFAULT 0,
  relationship_stage_at_time TEXT,

  is_replayable BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,

  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, persona_id, memory_type, title)
);
```

### 4.3 LUMIN 그룹 메타 ✅ 구현됨 (마이그 013_lumin_group.sql)
`persona_core`에 추가된 컬럼: `group_id` / `member_role` / `member_position` /
`mbti` / `birthday` / `signature_color` / `trainee_years` / `opening_message`.
LUMIN 7명 seed는 014_lumin_seed.sql.

### 4.4 Subscription Tier ✅ 구현됨 (마이그 001 + 011)
`users`: `subscription_tier TEXT CHECK ('free'|'standard'|'lumin_pass') DEFAULT 'free'`,
`is_premium BOOLEAN`, `premium_expires_at TIMESTAMPTZ`.
주기 추적은 별도 `subscriptions` 테이블 (011): `current_period_start/end`,
`stripe_subscription_id`, `plan_id`. webhook(`/api/webhooks/stripe`)이
양쪽 모두 동기화.

### 4.5 그룹 단톡방 ✅ 구현됨 (마이그 013_lumin_group.sql)
`group_chat_rooms` (user_id, group_id, room_type, member_persona_ids[])
+ `group_chat_messages` (room_id, sender_type, sender_persona_id,
content, sequence_number) 모두 존재.

### 4.6 운영/측정 인프라 (마이그 022~031)

P0/P1/P2 + Sync 작업으로 추가됨:

- **022 admin_audit_log + ban**: `admin_audit_log` (action / target / before/after JSONB),
  `users.is_banned + banned_at + banned_reason`. 모든 admin write 자동 기록.
- **023 moderation_flags**: 5 카테고리 (sexual / real_idol / drugs / violence /
  politics) Hard Rules 위반 큐. `lib/moderation.ts`가 chat 사전/사후 차단 + flag 적재.
- **024 persona_projects**: admin/personas의 폴더 분류 + `persona_core.project_id` FK.
- **025 lumin_events**: 그룹 캘린더(member_birthday / debut_anniversary / comeback / release / fan_day).
  데뷔 4/7 seed 포함.
- **026 user_attribution**: `users.utm_source/medium/campaign/content/term/landing_path/first_referrer`.
  signup callback이 localStorage UTM을 자동 저장.
- **027 influencer_crm**: 시딩 명단 + payout + UTM 연결로 ROAS 자동 계산.
- **028 scenario_review**: scenario_templates에 `review_status` (draft/in_review/approved/
  rejected) + 검토 메타 + lint_findings JSONB. runtime은 `review_status='approved'`만 노출.
- **029 experiments**: `experiments` + `experiment_assignments` (sticky variant) +
  `experiment_events`. SDK는 `lib/experiments.ts`. webhook이 PASS 결제 시
  active 실험에 자동 fan-out.
- **030 onboarding_variant**: `users.onboarding_variant` (A/B 코호트 추적).
- **031 founders_edition**: `subscription_tier` CHECK에 `founders_edition` 추가 + `users.founders_number` (1–100, unique sparse) + `claim_founders_number(p_user_id)` SECURITY DEFINER RPC (advisory lock으로 동시 클레임 직렬화, service_role only). webhook이 Founders Edition 결제 시 호출. 카드/음성 편지/맞춤 시나리오 테이블은 각 기능 구현 시 별도 마이그.

---

## 5. AI Agent System (lib/ai-agent/)

### 핵심 모듈
- **`core/ai-agent.ts`** — 메인 오케스트레이터 (`AIAgent.processMessage`)
- **`core/llm-client.ts`** — OpenRouter API 래퍼
- **`core/model-selector.ts`** — 멀티모델 라우팅 (캐릭터/상황별 모델 선택)
- **`core/prompt-engine.ts`** — 시스템 프롬프트 빌더

### 메모리
- **`memory/memory-service.ts`** — 의미 메모리 (pgvector 임베딩)
- **`memory/embedding-service.ts`** — 임베딩 생성/검색
- **`memory/persona-config-service.ts`** — Origin 페르소나 캐시

### 시나리오/이벤트
- **`modules/scenario-service.ts`** — 통합 시나리오 인터페이스
- **`modules/guided-scenario-engine.ts`** — 플롯 포인트 + AI 생성 하이브리드
- **`modules/dynamic-scenario-engine.ts`** — 완전 동적 생성 + 품질 게이트
- **`modules/scenario-session-manager.ts`** — 세션 통합 관리
- **`modules/event-trigger-engine.ts`** — 이벤트 평가 엔진
- **`modules/event-trigger-service.ts`** — 이벤트 스케줄링
- **`modules/emotional-state-tracker.ts`** — 감정 상태 추적

자세한 시나리오 시스템: [`SCENARIO_SYSTEM.md`](./SCENARIO_SYSTEM.md)

---

## 6. 유저 플로우 (USER_FLOW)

```
[/onboarding] A/B 테스트
  ├─ 변형 A (50%): 페르소나 선택 → 시나리오 → 가입 유도
  └─ 변형 B (50%): iOS 잠금화면 → 알림 → 시나리오 → 가입 유도
       ↓ OAuth (Google/Discord)
[/auth/callback] OAuth 핸들러 → users 테이블 upsert (tokens 100, etc.)
       ↓
[/follow-personas] 카테고리 → 페르소나 그리드 (LUMIN 멤버 7명 중 5+ 팔로우)
  → preferred_target_audience 저장 / initial_follows_completed=true
       ↓
[/?from_onboarding=true] 메인 페이지
  → 로그인 체크 / 탭 네비게이션 (home/dm/create/activity/profile)
  → 출석 체크, 스트릭 보너스
  → 튜토리얼 시작 (1초 후, 미완료 시)
       ↓
INITIAL_TUTORIAL (~15초)
  ├─ 피드 소개 (auto 3.5s) — [data-tutorial="home-feed"]
  ├─ 홈 버튼 (auto 2.5s) — [data-tutorial="home-button"]
  ├─ DM 버튼 (click) — [data-tutorial="dm-button"]
  └─ 프로필 버튼 (click) — [data-tutorial="profile-button"]
       ↓
[웰컴 오퍼 모달] (튜토리얼 완료 후)
  → Welcome Offer ($49.50 첫 달 50% off)
  → 24시간 카운트다운, 이탈 방지, 플로팅 CTA
       ↓
메인 앱 사용
```

### 알려진 이슈
- **🟢 웰컴 모달 타이밍**: `components/providers/WelcomeOfferProvider.tsx:117`이 이미 `isTutorialCompleted && !isTutorialActive` 게이트로 튜토리얼 완료 후에만 열림. 해결됨.
- **🟢 호감도 페르소나 하드코딩** (`OnboardingSignup.tsx:54`): `persona_id: 'jun'` → 선택된 페르소나로 변경

---

## 7. 튜토리얼 시스템

| 튜토리얼 | 상태 | 트리거 |
|---|---|---|
| **Initial** | ✅ 작동 | 메인 페이지 첫 진입 (`app/(marketing)/page.tsx`) |
| **Suggested Friends** | ✅ 작동 | DM 목록 첫 방문 (`components/dm/DMList.tsx`) |
| **DM** | ✅ 작동 | 첫 DM 채팅방 진입 (`app/dm/[personaId]/page.tsx`) |
| **Scenario** | ✅ 작동 | 첫 시나리오 플레이 (`components/scenario/ScenarioPlayer.tsx`) |
| **Profile** | ✅ 작동 | 첫 프로필 방문 (`app/profile/[personaId]/page.tsx`) |

전체 완성도 100% (5/5 작동). 정의는 `lib/tutorial-data.ts`, `data-tutorial=` selector는 모든 대상 DOM 요소에 존재.

### 시스템 구조
- **`lib/stores/tutorial-store.ts`** — Zustand + localStorage 영속성
- **`components/tutorial/SpotlightTutorial.tsx`** — radial-gradient 포커스, 툴팁 위치 계산
- **`components/tutorial/useTutorial.ts`** — 훅 (`startInitialTutorial`, `startDMTutorial` 등)
- **`lib/tutorial-data.ts`** — 튜토리얼 정의

### 향후 개선 (선택)
- **분기별 튜토리얼**: 컴백 시즌 / 멤버 생일 / 새 시나리오 출시 시 단계별 가이드
- **개인화**: 유저의 첫 멤버 선택을 기반으로 멘트 변형
- **A/B 실험**: `lib/experiments.ts`와 결합해 튜토리얼 variant 효과 측정 (`onboarding_variant` 컬럼 활용)
- 트리거 로직: 각 트리거 위치 페이지에서 `startXxxTutorial()` 호출

---

## 8. API 엔드포인트 (요약)

전체 스펙: [`API_DESIGN.md`](./API_DESIGN.md)

### 인증
- `POST /api/auth/oauth` — Google / Discord
- `POST /api/auth/refresh`

### 유저
- `GET/PUT /api/user/profile`
- `POST /api/user/persona` — 유저 페르소나 설정
- `POST /api/user/onboarding/complete`

### 페르소나/시나리오
- `GET /api/personas` / `GET /api/personas/:personaId`
- `POST /api/scenario/start` / `POST /api/scenario/advance`

### DM/AI
- `POST /api/ai/chat` — 메인 채팅 엔드포인트 (토큰 차감 포함)
- `GET /api/dm/list` / `POST /api/dm/read`

### 메모리
- `GET /api/memories` / `GET /api/memories/:personaId` / `GET /api/memories/:personaId/:memoryId`

### 결제 (Stripe — LUMIN PASS / Standard 단일 구독 모델)
- `GET / POST /api/subscriptions/checkout` — `lib/pricing.ts` SoT 사용 (PASS $99 / Standard $19)
- `GET / POST /api/subscriptions/welcome-offer` — PASS 50% off ($49.50), 가입 후 24h 한정
- `POST /api/webhooks/stripe` — `subscription_tier` + `is_premium` 동기화 + 활성 실험에 conversion fan-out
- 토큰 IAP 엔드포인트(`/api/checkout`, `/api/payments/checkout`)는 폐기·삭제됨

### 어드민 (P0 + P1 + P2 + 동기화 작업 후)
콘텐츠
- `/api/admin/scenarios/generate` / `/api/admin/scenarios/save`
- `/api/admin/scenarios/[id]/review` — submit / approve / reject + Hard Rules lint 게이트
- `/api/admin/scenarios/review-queue` — 발행 큐
- `/api/admin/triggers/*` / `/api/admin/events*` (LUMIN 캘린더, 마이그 025)

운영
- `/api/admin/users/[userId]/tokens` — 토큰 조정 + audit log
- `/api/admin/users/[userId]/ban` — 정지 (마이그 022)
- `/api/admin/users/[userId]/persona-progress` — 7-멤버 진행 카드
- `/api/admin/subscriptions` — 구독 콘솔 + Stripe 환불 발사
- `/api/admin/metrics/mrr` — MRR / 티어 분포
- `/api/admin/llm-usage` — LLM 비용 추적
- `/api/admin/logs/{errors,activity}` — 로그 뷰어
- `/api/admin/moderation` — 모더레이션 큐 (마이그 023)

GTM / 측정
- `/api/admin/marketing-insights` — 채널별 PASS 전환 (`users.utm_*` 마이그 026)
- `/api/admin/influencers*` — 인플루언서 시딩 CRM (마이그 027)
- `/api/admin/retention` — 코호트 D1/D7/D30
- `/api/admin/experiments*` — A/B 실험 (마이그 029, runtime SDK는 `lib/experiments.ts`)
- `/api/admin/onboarding/analytics` — 온보딩 퍼널

신규 인프라 (사용자 코드와 통합 상태)
- ✅ `users.subscription_tier` ⇔ `is_premium` webhook 동기화 (P0-Sync)
- ✅ `review_status='approved'` 필터 — `lib/ai-agent/modules/scenario-service.ts` 적용 (P0-Sync)
- ✅ Hard Rules lint — `app/api/ai/chat` 사전/사후 차단 (P0-Sync)
- ✅ UTM 캡처 → 가입 row + analytics 이벤트 (P1-Sync)
- ✅ 실험 conversion 자동 fan-out — webhook (P1-Sync)
- ⏳ 추가 튜토리얼 4개 (DM/Profile/Scenario/SuggestedFriends) — 미구현 (§7 참조)

---

## 9. 기술 개선 체크리스트 (22개 이슈 중 핵심)

### 🔴 Critical (5개)
1. **delivery_conditions 미구현** (`ai-agent.ts:332`) — 호감도/시간대/플래그 조건 검증 추가
2. **토큰 차감 Race Condition** (`api/ai/chat/route.ts`) — `017_atomic_token_functions.sql`로 원자적 차감 함수 (FOR UPDATE)
3. **메모리 추출 fire-and-forget 에러 무시** — 큐 기반 재시도 + `error_logs` 테이블
4. **이벤트 중복 스케줄링** — 1시간 내 중복 체크 + 일일 한도 (5건)
5. **세션 검증 부족** — userId/personaId 일치 검증

### 🟠 High (5개)
1. **메모리 만료 시스템** — 90일 + importance≤3 자동 비활성, 10개+ 통합 요약
2. **입력 검증 (Zod)** — 모든 API 라우트 스키마 검증
3. **Rate Limiting** — Upstash Redis (chat 20/m, event 60/m, memory 30/m, default 100/m)
4. **DB 인덱스 부족** — `019_performance_indexes.sql` 11개 복합 인덱스
5. **필드명 오류** (`api/memory/route.ts:105`) — `affection_level` → `affection`, `current_stage` → `relationship_stage`

### 🟡 Medium (6개)
- 메모리 패턴 정밀화 (신뢰도 0.6 임계값 + 중복 제거)
- `incrementMessages` 호출 누락
- Connection Pool (싱글톤 클라이언트)
- 이벤트 조회 컬럼 오류 (`priority` 컬럼 없음)
- Upsert 중복 방지 (Jaccard 유사도 0.7)
- Memory Context Overflow (4000 토큰 한도)

### 🟢 Low (6개)
- Soft Delete (`deleted_at`)
- Request Timeout (30s)
- Audit Logging
- N+1 쿼리 수정 (DM 목록)
- PersonaLoader 캐시 TTL (1h)
- Memory Context Overflow (3.6과 함께)

### 신규 필요 마이그레이션 (피벗 후)
| 번호 | 파일 | 내용 |
|---|---|---|
| 062 | `lumin_group_metadata.sql` | group_id, member_role, mbti, birthday, signature_color |
| 063 | `subscription_tiers.sql` | free/standard/lumin_pass |
| 064 | `group_chat_rooms.sql` | 그룹 단톡방 + 메시지 테이블 |

> **마이그레이션 번호 주의:** 018·019에 중복이 있음 (018_error_logs/018_referral_system, 019_daily_streak/019_performance_indexes). 신규 번호는 062부터 사용 권장.

---

## 10. 디렉토리 구조 요약

```
app/
├── (marketing)/  # 홈/피드
├── (app)/        # 앱 컨테이너
├── admin/        # 어드민
├── api/          # API 라우트
├── auth/, dm/, profile/, onboarding/, follow-personas/, scenario/, settings/

components/
├── chat/, dm/, feed/, modals/, onboarding/, profile/, scenario/, sns/, tutorial/, ui/, providers/

lib/
├── ai-agent/{core,memory,modules,utils}
├── i18n/, stores/, relationship/, validations/, middleware/

supabase/migrations/  # 009 → 061+ (062~064 추가 예정)
```
