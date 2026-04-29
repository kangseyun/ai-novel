# Luminovel

K-pop 가상 아이돌 그룹 **LUMIN** (7인조, 자체 IP)과의 클린(전연령) 연애 시뮬레이터. Next.js 16 + Supabase + OpenRouter. 목표 $99 PASS 10명 = $990 MRR.

---

## 🔴 Hard Rules — 절대 어기지 말 것

콘텐츠:
- 19+/성적 콘텐츠 일체 금지 (전연령 톤)
- 실명 아이돌·소속사·실제 곡명 언급 금지 (자체 IP만)
- 약물·음주 미화, 극단적 폭력, 정치·종교 발언 금지
- 멤버 7명 외 다른 캐릭터 추가 금지 (사용자 승인 없이)

코드:
- `console.log` 프로덕션 커밋 금지
- `any` 타입 / implicit any 금지 (strict TypeScript)
- 새 환경변수 추가 시 `.env.example` 동시 갱신
- 옛 표기 사용 금지: ECLIPSE / Sophie / coins / gems / hearts / acquaintance / close_friend / romantic / intimate / lover

DB:
- `npx supabase db push` 금지 → MCP Supabase 도구 사용
- `personas` (view) 사용. `persona_core` 직접 조회 금지 (사용자 노출 화면)
- 마이그레이션 신규 번호는 **062부터** (018·019에 중복 있음)

---

## 📁 Where to find things

| 필요한 것 | 문서 |
|---|---|
| 비즈니스 / 가격 / GTM / 12주 로드맵 | `docs/STRATEGY.md` |
| 그룹 IP / 멤버 7명 톤·말투·케미 | `docs/LUMIN.md` |
| 시스템 / DB 모델 / 유저 플로우 / 튜토리얼 / 22개 기술 개선 | `docs/ARCHITECTURE.md` |
| 시나리오 엔진 v2 / 이벤트 트리거 | `docs/SCENARIO_SYSTEM.md` |
| API 엔드포인트 스펙 | `docs/API_DESIGN.md` |

---

## ⚙️ Operating procedures

**DB 변경 시:**
1. `mcp__supabase__list_tables` 로 현재 스키마 확인
2. 마이그레이션 작성 (`supabase/migrations/NNN_name.sql`, NNN ≥ 062)
3. `mcp__supabase__apply_migration` 으로 적용
4. RLS 정책 추가 필수 (`auth.uid() = user_id` 패턴)

**새 API 라우트 추가 시:**
1. `lib/auth.ts` 의 `getAuthUser` 로 인증 → 실패 시 `unauthorized()`
2. `lib/validations/` 에 Zod 스키마 정의 + 입력 검증
3. `lib/middleware/rate-limit.ts` 적용 (chat 20/m, default 100/m)
4. `createClient()` (`lib/supabase-server.ts`) 로 RLS 클라이언트 생성

**시나리오 추가 시:**
1. `docs/LUMIN.md` 톤 가이드 + Hard Rules 체크
2. `docs/SCENARIO_SYSTEM.md` 의 `forbidden_topics` 적용
3. PASS 전용 분기는 `requires_tier: 'lumin_pass'` (코인 잠금 모델 ❌)

**멤버 캐릭터 작업 시:**
1. `docs/LUMIN.md` 의 해당 멤버 섹션이 진실의 원천
2. 옛 `personas/01-05` 파일은 삭제됨 — git history만 참조
3. 멤버 ID, MBTI, 컬러, 호칭 등은 `LUMIN.md` 와 일치시킬 것

**커밋 전:**
- `npm run lint` 통과
- `npm run build` 통과 (TypeScript 에러 없음)
- 변경된 환경변수 있으면 `.env.example` 갱신
- 사용자가 명시적으로 요청하지 않으면 커밋하지 말 것

---

## 🚫 Don't

- 옛 다크 로맨스 컨셉 캐릭터(Daniel/Adrian/야쿠자/CEO 등) 부활시키지 말 것
- 코인/IAP 결제 모델로 회귀하지 말 것 (단일 구독 PASS 모델만)
- 19+ Sleep Aid / Pillow Talk / "섹슈얼 테라피" 기능 부활시키지 말 것
- 임의로 새 페르소나·시나리오·테이블·결제 티어 추가하지 말 것 (사용자 확인 후)
- 옛 OAuth(Apple) 추가하지 말 것 (Google + Discord만 지원)
- LLM을 OpenRouter 외 직접 호출(OpenAI/Anthropic SDK)로 바꾸지 말 것

---

## 📌 Quick reference

- **Supabase Project ID:** `zwoyfqsavcghftbmijdc`
- **OAuth:** Google + Discord (Apple ❌)
- **LLM:** OpenRouter (멀티모델, `lib/ai-agent/core/model-selector.ts`)
- **결제 티어:** `free` / `standard` / `lumin_pass` (in `users.subscription_tier`)
- **관계 단계:** `stranger` → `fan` → `friend` → `close` → `heart` (💗)
- **화폐 단위:** `tokens` (초기 100)
- **LUMIN 멤버 ID:** `haeon` / `kael` / `ren` / `jun` / `adrian` / `sol` / `noa`
- **모바일 폭:** max-w-430px / Dark theme / Korean default + i18n (KR/EN/JA/ES)
- **경로 별칭:** `@/` (예: `@/lib/stores/auth-store`)
