# Luminovel — Backend API 설계 문서

> **2026-05-06 갱신.** 이 문서는 현재 코드(`app/api/**`)와 1:1 정합 상태.
> 옛 모델(코인/IAP, 다크 로맨스, ECLIPSE, hack/XP)은 모두 코드에서 제거됨.
> 결제 SoT는 [`lib/pricing.ts`](../lib/pricing.ts), DB 스키마는 [`supabase/migrations/`](../supabase/migrations/) 001~031.

## 기술 스택

- **Database**: Supabase (PostgreSQL + pgvector for semantic memory)
- **Auth**: Supabase Auth (OAuth: **Google + Discord**, Apple ❌)
- **LLM**: OpenRouter (멀티모델 — `lib/ai-agent/core/model-selector.ts`)
- **TTS**: ElevenLabs (멤버별 음성 클로닝 — 자산 단계, runtime API 미구현)
- **Image**: Kling AI (멤버별 외모 시드 — `lib/kling-ai.ts`)
- **Payment**: Stripe (LUMIN PASS / Standard 단일 구독)
- **Analytics**: Mixpanel + Firebase + GA4 + Meta Pixel + Airbridge

---

## 1. 인증 (Authentication)

OAuth-only. 이메일/비번 회원가입은 미사용 — Supabase Auth가 전담.

### 1.1 OAuth 로그인 시작
```
POST /api/auth/oauth
Content-Type: application/json
{ "provider": "google" | "discord" }

Response 200:
{ "url": "https://<project>.supabase.co/auth/v1/authorize?provider=..." }
```
클라이언트는 받은 `url`로 redirect. 콜백은 `app/auth/callback/page.tsx`가 처리
(localStorage 세션 저장 + `users` insert + UTM 캡처).

### 1.2 로그아웃
```
POST /api/auth/logout
Authorization: Bearer <access_token>

Response 200: { "success": true }
```
세션 삭제 + localStorage 토큰 제거.

### 1.3 토큰 갱신
```
POST /api/auth/refresh
Content-Type: application/json
{ "refresh_token": "..." }

Response 200:
{ "session": { "access_token": "...", "refresh_token": "..." } }
```
`apiClient.tryRefreshToken()`이 401 시 자동 호출.

---

## 2. 사용자 (User)

### 2.1 프로필 조회
```
GET /api/user/profile
Authorization: Bearer <token>

Response 200:
{
  "user": {
    "id": "uuid",
    "email": "...",
    "nickname": "...",
    "tokens": 100,
    "subscription_tier": "free" | "standard" | "lumin_pass",
    "is_premium": boolean,
    "premium_expires_at": "ISO8601" | null,
    "onboarding_completed": boolean,
    "initial_follows_completed": boolean,
    "is_banned": boolean
  },
  "subscription": {
    "plan_id": "lumin_pass_monthly" | ...,
    "status": "active" | "trialing" | "past_due" | "canceled",
    "current_period_end": "ISO8601",
    "cancel_at_period_end": boolean
  } | null
}
```

### 2.2 프로필 수정
```
PUT /api/user/profile
Authorization: Bearer <token>
{ "nickname"?: string, "bio"?: string, "profile_image"?: string }
```

### 2.3 온보딩 완료 처리
```
POST /api/user/onboarding/complete
Authorization: Bearer <token>
{
  "variant": "a" | "b",
  "persona_id": "haeon" | ...,
  "affection_gained": number,
  "choices_made": [{ "scene_id": string, "choice_id": string }]
}
```
`users.onboarding_completed=true`, `users.onboarding_variant`에 variant 기록.

---

## 3. 페르소나 (Persona)

### 3.1 페르소나 목록
```
GET /api/personas
Authorization: Bearer <token>

Response 200:
{
  "personas": [
    {
      "id": "haeon",
      "name": "해온",
      "display_name": "HAEON",
      "username": "haeon",
      "profile_image_url": "...",
      "bio": "...",
      "is_premium": boolean,
      "tags": [...],
      "category": "...",
      "followers_count": number
    }
  ]
}
```
SoT view: `personas` (security_invoker, base table `persona_core`).

### 3.2 페르소나 상세
```
GET /api/personas/[personaId]
Authorization: Bearer <token>

Response 200:
{ "persona": { ...full record... } }
```

### 3.3 추천 친구 / 잠금 해제
```
GET  /api/personas/suggested      → 추천 페르소나 N명
POST /api/personas/unlock         → 토큰 차감 + persona 해제
```

---

## 4. 시나리오 (Scenario)

옛 `/api/game/*` 라우트는 모두 폐기. 시나리오 진행은 `/api/scenario`로 통일.

### 4.1 시나리오 시작 / 조회
```
GET /api/scenario?scenarioId=...&personaId=...
Authorization: Bearer <token>

Response 200:
{
  "scenario": { id, title, ... },
  "currentScene": { id, content, choices? },
  "progress": { ... }
}
```
Runtime은 `review_status='approved'` + `is_active=true`만 노출 (`lib/ai-agent/modules/scenario-service.ts`).

### 4.2 시나리오 진행
```
POST /api/scenario/advance
{
  "scenarioId": "...",
  "sceneId": "...",
  "choiceId"?: "..."
}
```

### 4.3 시나리오 상세 조회 (단일)
```
GET /api/scenarios/[id]
```
`is_active && review_status='approved'` 조건. 조건 미충족 시 404.

---

## 5. AI 채팅 (LLM)

OpenRouter 경유. 모든 LLM 호출이 이 라우트를 거침.

### 5.1 채팅
```
POST /api/ai/chat
Authorization: Bearer <token>
{
  "personaId": "haeon",
  "message": "...",
  "sessionId"?: "uuid",
  "choiceData"?: { ... }
}

Response 200:
{
  "sessionId": "uuid",
  "response": { "content": "...", "emotion": "...", "innerThought": "..." | null },
  "choices"?: [...],
  "affectionChange": number,
  "tokenBalance": number,
  "scenarioTrigger"?: { ... },
  "moderated"?: true
}

Response 422 (Hard Rules 위반):
{
  "error": "content_policy",
  "message": "해당 주제는 다룰 수 없어요. ...",
  "categories": ["sexual" | "real_idol" | "drugs" | "violence" | "politics"]
}
```
**사전 차단**: user_message에 critical/high 매치 시 LLM 호출 전 422.
**사후 교체**: AI 응답에 critical/high 매치 시 generic fallback으로 자동 대체 + flag 기록.
**Hard Rules**: `lib/moderation.ts`의 5 카테고리 + `lib/ai-agent/core/prompt-engine.ts`가 시스템 프롬프트에 강제 주입.

### 5.2 동적 선택지 생성
```
POST /api/llm/generate-choices
{ "messages": [...], "personaId": "...", "context"?: {...} }
```

### 5.3 세션 / 히스토리
```
GET /api/ai/session?personaId=...     → 활성 세션 조회
GET /api/ai/history?sessionId=...     → 메시지 히스토리
GET /api/ai/relationship?personaId=... → 호감도 / 단계 조회
```

---

## 6. DM (다이렉트 메시지)

### 6.1 DM 목록
```
GET /api/dm/list
Authorization: Bearer <token>

Response 200:
{
  "conversations": [
    { "personaId", "lastMessage", "lastMessageAt", "unreadCount", "stage", "affection" }
  ]
}
```

### 6.2 읽음 처리
```
POST /api/dm/read
{ "personaId": "..." }
```

DM 채팅 자체는 `/api/ai/chat`이 담당 — 별도 `/api/dm/message` 라우트 없음.

---

## 7. 메모리 (Memory / RAG)

### 7.1 메모리 조회
```
GET /api/memories                          → 전체
GET /api/memories/[personaId]              → 페르소나별
GET /api/memories/[personaId]/[memoryId]   → 단일
```
저장은 `lib/ai-agent` 내부에서 자동 수행 (서비스 레이어).

---

## 8. 피드 (Feed)

### 8.1 피드 조회
```
GET /api/feed?page=1&limit=20
Authorization: Bearer <token>
```

### 8.2 포스트 작성
```
POST /api/feed/post
{ "content": "...", "personaId"?: "..." }
```

### 8.3 이벤트
```
GET /api/feed/events                  → 알림/이벤트 목록
PUT /api/feed/events/[eventId]/read   → 읽음 처리
```

---

## 9. 결제 / 구독 (Stripe)

옛 `/api/checkout`, `/api/payments/checkout` (토큰 IAP) 모두 폐기.
SoT는 [`lib/pricing.ts`](../lib/pricing.ts) — **LUMIN PASS $49 (v2) / $490 연간**, Standard $19/$190, **Founders Edition $499 one-time (100석)**.
옛 PASS $99 / $990 키 (`lumin_pass_monthly`, `lumin_pass_yearly`)는 grandfathered 구독자 전용 (`legacy: true`).
Welcome Offer ($49.50)는 **폐기됨** — 신가 PASS $49 도입으로 무의미.

### 9.1 구독 플랜 목록 (공개 카탈로그)
```
GET /api/subscriptions/checkout
Authorization: Bearer <token>

Response 200:
{
  "plans": [
    { "id": "lumin_pass_monthly_v2", "tier": "lumin_pass",
      "interval": "month", "monthly_usd": 49, "unit_amount_cents": 4900, ... },
    { "id": "lumin_pass_yearly_v2", "interval": "year",
      "monthly_usd": 40.83, "unit_amount_cents": 49000, ... },
    { "id": "standard_monthly", "interval": "month", "monthly_usd": 19, ... },
    { "id": "standard_yearly", "interval": "year", "monthly_usd": 15.83, ... }
  ]
}
```
`legacy: true` 플랜은 `publicSubscriptionCatalog()` 필터로 응답에서 제외.

### 9.2 구독 결제 세션 생성
```
POST /api/subscriptions/checkout
{ "plan_id": "lumin_pass_monthly_v2" | "lumin_pass_yearly_v2" | "standard_monthly" | "standard_yearly" }

Response 200: { "url": "https://checkout.stripe.com/..." }
Response 410 (legacy plan 거부):
{ "error": "Legacy plan is no longer available", "alternativePlanId": "lumin_pass_monthly_v2" }
```

### 9.3 Founders Edition (one-time, 100석 한정) ✨ NEW
```
GET /api/subscriptions/founders
Response 200:
{
  "product": { "id": "founders_edition", "unit_amount_cents": 49900, ... },
  "claimed": number,
  "total_supply": 100,
  "remaining": number,
  "available": boolean
}

POST /api/subscriptions/founders
Authorization: Bearer <token>
Response 200: { "url": "https://checkout.stripe.com/..." }
Response 400: { "error": "You already own Founders Edition", "founders_number": int }
Response 410: { "error": "All Founders Edition slots claimed" }
```
모드 `payment` (구독 ❌). webhook이 `claim_founders_number` RPC로 atomic 번호 부여 (1–100).

### 9.4 Welcome Offer (DEPRECATED)
```
GET /api/subscriptions/welcome-offer
  → { "eligible": false, "deprecated": true, "alternativePlanId": "lumin_pass_monthly_v2" }
POST → 410 Gone
```
2026-05-06 폐기. 옛 `welcome_offer_claimed=true` row는 결제 이력으로 보존.

### 9.5 구독 관리
```
GET    /api/subscriptions/manage    → 현재 구독 상태
POST   /api/subscriptions/manage    → cancel_at_period_end 토글
```

### 9.6 Stripe Webhook
```
POST /api/webhooks/stripe
Stripe-Signature: ...

처리 이벤트:
- checkout.session.completed
  ├ metadata.product_type='founders_edition' → claim_founders_number RPC (atomic 1–100 부여) +
  │  subscription_tier='founders_edition', is_premium=true, premium_expires_at=NOW+365d,
  │  purchases insert (upsert on stripe_session_id), 분석/실험 fan-out
  ├ metadata.is_welcome_offer (legacy) → 보너스 크레딧 + welcome_offer_claimed=true
  └ metadata.token_amount (legacy IAP) → add_tokens
- customer.subscription.created/updated → tier 동기화 (단, founders_number IS NOT NULL이면
  founders_edition tier 영구 유지)
- customer.subscription.deleted → tier='free' (단, founders는 유지)
- invoice.payment_succeeded → 구독 토큰 부여 (PASS 5000, Standard 1500)
- invoice.payment_failed → notifications insert

실험 fan-out 이벤트:
- founders_purchased (Founders Edition only)
- pass_purchased / standard_purchased
- subscription_started (모든 결제)
```

---

## 10. 어드민 (Admin) — 30+ endpoints

모든 admin 라우트는 `lib/auth.ts` `requireAdmin()` 게이트.
모든 write는 `admin_audit_log`에 자동 기록.

### 10.1 운영
```
GET  /api/admin/metrics/mrr                     → MRR + 티어 분포 + PASS 마일스톤
GET  /api/admin/subscriptions                   → 활성 구독 리스트 (필터: status / tier / expiring)
GET  /api/admin/subscriptions/[id]              → 상세 + 최근 결제/환불 + Welcome Offer
POST /api/admin/subscriptions/[id]/refund       → Stripe API 환불 + cancel/at-period-end + audit
GET  /api/admin/llm-usage                       → 30일 비용/모델/유저/task 분석
GET  /api/admin/moderation                      → Hard Rules 위반 큐
PATCH /api/admin/moderation/[id]                → acknowledged / dismissed / escalated
GET  /api/admin/logs/errors                     → error_logs 검색 + 요약
PATCH /api/admin/logs/errors                    → resolved 토글 + audit
GET  /api/admin/logs/activity                   → user_activity_log
```

### 10.2 콘텐츠
```
GET  /api/admin/lumin/stats                     → 7명 멤버 KPI / 인기 시나리오 / 단계 분포
GET  /api/admin/scenarios/review-queue          → 발행 큐 (필터: status)
POST /api/admin/scenarios/[id]/review           → action=submit|approve|reject + Hard Rules lint 게이트
POST /api/admin/scenarios/save                  → 시나리오 저장 (default review_status='draft')
POST /api/admin/scenarios/generate              → AI 시나리오 생성 (LLM)
```

### 10.3 페르소나
```
POST /api/admin/persona/generate                       → AI 메타 자동 생성
POST /api/admin/persona/generate-image                 → Kling AI 이미지 생성
GET  /api/admin/persona/generate-image/status          → 진행 상태 폴링
POST /api/admin/persona/generate-auto-prompts          → 자동 prompt 작성
POST /api/admin/generate-images                        → 일괄 이미지 생성 (배치)
```

### 10.4 유저 관리
```
GET  /api/admin/users/[userId]/persona-progress     → 7-멤버 진행 카드
POST /api/admin/users/[userId]/tokens               → 토큰 ± + reason + audit
POST /api/admin/users/[userId]/ban                  → ban/unban + reason + audit (admin self-protection)
POST /api/admin/users/[userId]/memory-search        → pgvector RAG 시뮬
```

### 10.5 자동화
```
GET    /api/admin/events                  → LUMIN 캘린더 + 예정된 scheduled_events
POST   /api/admin/events                  → 이벤트 생성 (member_birthday / debut_anniversary / comeback / ...)
PATCH  /api/admin/events/[id]
DELETE /api/admin/events/[id]
GET    /api/admin/playground/models       → OpenRouter 모델 카탈로그
POST   /api/admin/playground/chat         → 페르소나 응답 시뮬 (LLM)
```

### 10.6 그로스 / 측정
```
GET    /api/admin/marketing-insights              → 채널별 PASS 전환 + CAC
GET    /api/admin/onboarding/analytics            → 온보딩 funnel + 코호트
GET    /api/admin/retention                       → D1/D7/D30 코호트 히트맵

GET    /api/admin/influencers
POST   /api/admin/influencers                     → 인플루언서 등록 + utm_campaign 연결
PATCH  /api/admin/influencers/[id]                → 상태 / payout 갱신
DELETE /api/admin/influencers/[id]

GET    /api/admin/experiments
POST   /api/admin/experiments                     → 실험 정의 (variants + conversion_events)
PATCH  /api/admin/experiments/[id]                → status 전환 (draft → running → paused → complete)
DELETE /api/admin/experiments/[id]
GET    /api/admin/experiments/[id]/results        → variant 별 conversion rate
```

### 10.7 마케팅 콘텐츠
```
GET/POST   /api/admin/marketing/projects
GET/POST   /api/admin/marketing/copies
GET/POST   /api/admin/marketing/images
GET/POST   /api/admin/marketing/tasks
POST       /api/admin/marketing/generate-copy            → AI 카피 생성 (LLM)
POST       /api/admin/marketing/generate-ad              → AI 광고 (LLM + 이미지)
POST       /api/admin/marketing/upload/meta              → Meta Ad API 업로드
POST       /api/admin/marketing/insights                 → Meta/Google 광고 성과 조회 (platform+adId 필요)
```

---

## 11. 분석 (Analytics)

서버사이드 이벤트는 `lib/analytics-server.ts` (Meta CAPI + Mixpanel server-side).
클라이언트는 `lib/analytics.ts`로 GA4 + Mixpanel + Meta Pixel + Firebase + Airbridge.

자동 수집 이벤트:
- `SignUp` (UTM 동봉) — `auth/callback` 신규 가입
- `Login` — 기존 유저
- `Purchase` / `Subscribe` — Stripe webhook
- `OnboardingStart` / `OnboardingComplete` — 온보딩 페이지
- `InitiateCheckout` — `/shop`에서 PASS 클릭

명시적 호출 가능: `analytics.trackXxx()` (lib/analytics.ts).

---

## 12. 핵심 DB 테이블 (요약)

자세한 스키마는 `supabase/migrations/` 참조.

| 테이블 | 마이그 | 핵심 컬럼 |
|---|---|---|
| `users` | 001 + 026 + 030 + 031 | id / email / role / tokens / subscription_tier (free/standard/lumin_pass/founders_edition) / is_premium / utm_* / onboarding_variant / is_banned / founders_number (1–100) |
| `persona_core` | 002 + 013 | id / name / group_id / member_role / mbti / birthday / signature_color / project_id |
| `persona_projects` | 024 | 페르소나 폴더 분류 |
| `user_persona_relationships` | 003 | affection / relationship_stage / trust / intimacy / total_messages |
| `persona_memories` | 005 | semantic + structured 메모리 (pgvector) |
| `scenario_templates` | 006 + 028 | review_status / lint_findings / generation_mode (static/guided/dynamic) |
| `guided_scenario_*` / `dynamic_scenario_*` | 007 + 017 | v2 시나리오 세션 |
| `event_trigger_rules` | 008 | 호감도/시간/행동 기반 자동 메시지 |
| `marketing_*` (6 tables) | 009 | 광고 콘텐츠 파이프라인 |
| `onboarding_*` | 010 | A/B variant + 빌더 |
| `subscriptions` / `purchases` / `welcome_offer_purchases` | 011 | Stripe 구독 주기 + 결제 이력 |
| `llm_usage_records` / `user_llm_budgets` | 011 | OpenRouter 비용 추적 |
| `lumin_events` | 025 | 그룹 캘린더 (생일/데뷔/컴백) |
| `admin_audit_log` | 022 | 모든 admin write 기록 |
| `moderation_flags` | 023 | Hard Rules 위반 큐 |
| `influencers` | 027 | 시딩 CRM |
| `experiments` / `experiment_assignments` / `experiment_events` | 029 | A/B 실험 |

화이트리스트 view: `personas` (사용자 노출용).
신규 마이그레이션은 032부터 시작 (031은 Founders Edition 적용 ✅).

---

## 13. 환경 변수 (`.env.local`)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://olpnuagrhidopfjjliih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# OpenRouter
OPENROUTER_API_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Kling AI
KLING_ACCESS_KEY=...
KLING_SECRET_KEY=...

# Analytics
NEXT_PUBLIC_MIXPANEL_TOKEN=...
NEXT_PUBLIC_FIREBASE_*=...

# App
NEXT_PUBLIC_APP_URL=https://luminovel.ai
```

`.env.example` 항상 동기화 (CLAUDE.md Hard Rule).

---

## 14. 우선순위 / 배포 상태

코드 기반 인프라는 모두 완성. 운영 자산 + Stripe Live + 베타 모집이 남은 단계.
`docs/DEPLOY_PREFLIGHT.md`의 🔴 4건 처리 후 배포 가능.
