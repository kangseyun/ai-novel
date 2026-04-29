# Luminovel Project Context

> ⚠️ **2026-04-29 피벗 반영**
> 이 문서는 옛 다크 로맨스 컨셉(Sophie 페르소나, Asset Lock 코인 모델) 기준으로 작성됨.
> 현재 프로젝트는 **K-pop 가상 아이돌 그룹 LUMIN의 클린 연애 시뮬레이터** + **$99 LUMIN PASS 구독 모델**로 피벗됨.
> 자세한 내용은 [`CLAUDE.md`](./CLAUDE.md) 및 [`docs/pivot/PIVOT_OVERVIEW.md`](./docs/pivot/PIVOT_OVERVIEW.md) 참조.

## Project Overview (신규)
**Goal:** Build a clean (all-ages) **K-pop virtual idol dating simulator** featuring **LUMIN** — an original 7-member virtual K-pop boy group. Target **$990 MRR via 10 LUMIN PASS subscribers ($99/mo)** in 12 weeks.

**Core Concept:** "Your favorite member is watching only you" — exclusive intimacy via 1:1 DM + group chat + voice messages with personalized name calling + AI selfies.

**Members of LUMIN:** HAEON (leader, main vocal) / KAEL (main dancer) / REN (main rapper) / JUN (sub vocal, composer) / ADRIAN (visual, sub rapper) / SOL (maknae) / NOA (global member, KR-American).

## Technical Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS (v4) + Shadcn/Radix
- **Database:** Supabase (PostgreSQL + pgvector for semantic memory)
- **Auth:** Supabase Auth (Google + Discord OAuth)
- **LLM:** OpenRouter (multi-model routing via ModelSelector)
- **Voice:** ElevenLabs (per-member voice cloning)
- **Image:** Kling AI (per-member visual seeds)
- **Payment:** Stripe (+ Paddle backup)
- **Analytics:** Mixpanel + Firebase + GA4 + Meta Pixel + Airbridge
- **State:** Zustand
- **Icons:** Lucide React

## Key Documentation (`docs/`)
The `docs/` directory is the **Source of Truth** for the project's direction.

### 핵심 문서 (`docs/`):
- [`STRATEGY.md`](./docs/STRATEGY.md): 피벗 + 가격 + GTM (비즈니스 전체)
- [`LUMIN.md`](./docs/LUMIN.md): 그룹 IP + 멤버 7명 (캐릭터 톤 가이드)
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md): 시스템 + 데이터 모델 + 유저 플로우 + 튜토리얼 + 기술 개선 체크리스트
- [`SCENARIO_SYSTEM.md`](./docs/SCENARIO_SYSTEM.md): 시나리오 엔진 v2 (Static/Guided/Dynamic + 이벤트 트리거)
- [`API_DESIGN.md`](./docs/API_DESIGN.md): API 엔드포인트 스펙

## Hard Rules (절대 원칙)
1. **🔴 19+/성적 콘텐츠 일체 금지** — 클린 전연령 톤 유지
2. **🔴 실명 아이돌·소속사·실제 곡명 언급 금지** — 자체 IP만 사용
3. **🔴 약물·음주 미화 금지**
4. **🔴 극단적 폭력·정치·종교 발언 금지**

## Development Status
- **Current Phase:** Pivot consolidation (문서 정리 + LUMIN 멤버 데이터 마이그레이션)
- **Implemented:**
    - 전체 코드베이스 (인증, 채팅, 메모리, 시나리오 v2, 결제, 어드민) 약 95% 완성
    - 마이그레이션 009 → 061 적용 완료
    - 옛 페르소나 5명 데이터 (DB) — LUMIN 멤버로 마이그레이션 필요
- **Immediate Next Steps:**
    - DB 마이그레이션 `062_lumin_group_metadata.sql` (group_id, member_role, mbti, birthday, signature_color)
    - 마이그레이션 `063_subscription_tiers.sql` (free/standard/lumin_pass)
    - 마이그레이션 `064_group_chat_rooms.sql` (그룹 단톡방)
    - 멤버별 ElevenLabs 음성 클로닝
    - 멤버별 Kling AI 외모 시드 + 셀카 사전 생성

## Directory Structure
- `/app`: Next.js App Router pages
    - `/(marketing)`: Marketing/landing pages
    - `/admin`: Admin dashboard
    - `/api`: API routes
    - `/dm`, `/onboarding`, `/profile`, `/follow-personas`: Main flows
- `/components`: React components (`chat/`, `dm/`, `feed/`, `onboarding/`, `tutorial/`, `ui/`, `sns/`, `scenario/`)
- `/lib`:
    - `/ai-agent`: AI Agent system (core, memory, modules)
    - `/stores`: Zustand stores
    - `/i18n`: 다국어 (KR/EN/JA/ES 우선)
- `/supabase/migrations`: SQL migrations (009 → 061+)
- `/docs`: Strategic planning and requirement documents
- `/types`: TypeScript interfaces

## Commands
- `npm run dev`: Start development server (localhost:3000)
- `npm run build`: Build for production
- `npm run lint`: Run ESLint
