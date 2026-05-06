# Luminovel Project Context

> **2026-05-06 갱신** — 피벗 완료 + P0/P1/P2 + Sync 종료 상태.
> K-pop 가상 아이돌 그룹 LUMIN(7인조)의 클린 연애 시뮬레이터 + $99 LUMIN PASS 단일 구독.
> Source of Truth: [`CLAUDE.md`](./CLAUDE.md), [`docs/STRATEGY.md`](./docs/STRATEGY.md), [`lib/pricing.ts`](./lib/pricing.ts).

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

## Development Status (2026-05-06 갱신)
- **Current Phase:** Pre-launch — code is feature-complete and E2E-tested. `docs/DEPLOY_PREFLIGHT.md`의 🔴 4건만 처리하면 배포 가능.
- **Implemented:**
    - 코드베이스 100% (인증·채팅·메모리·시나리오 v2·결제·어드민)
    - 마이그레이션 001–030 적용 완료. 다음 신규 번호는 031.
    - LUMIN 7명 메타 + 그룹 단톡방 스키마: 마이그 013 (lumin_group)
    - 구독 티어 (free/standard/lumin_pass): 마이그 001 + 011
    - 어드민 P0/P1/P2: 22~030 (admin_audit_log / moderation_flags / persona_projects /
      lumin_events / utm_attribution / influencers / scenario review_status / experiments /
      onboarding_variant)
    - 모든 admin write가 `admin_audit_log`에 기록 + `requireAdmin()` 강제
    - Hard Rules: 시스템 프롬프트 주입 + chat 사전/사후 차단 + scenario lint CI
    - PASS 결제 모델 통일 (lib/pricing.ts SoT, Stripe lookup_keys: lumin_pass_*, standard_*)
- **Pending:**
    - 멤버별 ElevenLabs 음성 클로닝 (자산)
    - 멤버별 Kling AI 셀카 사전 생성 (자산 — prompts는 lib/kling-ai.ts에 7명 전부 있음)
    - 마케팅 정적 랜딩 분리 (P2-Sync, 후순위)
    - Mixpanel/Airbridge 외부 분석툴 채널 어트리뷰션 (admin은 utm_* 추적, 외부 동봉만 남음)

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
    - `/i18n`: 다국어 (현재 KR/EN. JA/ES는 1.0 PMF 후)
- `/supabase/migrations`: SQL migrations (001 → 030, 신규는 031부터)
- `/docs`: Strategic planning and requirement documents
- `/types`: TypeScript interfaces

## Commands
- `npm run dev`: Start development server (localhost:3000)
- `npm run build`: Build for production
- `npm run lint`: Run ESLint
