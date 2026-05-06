# Deploy Pre-flight Checklist

> **마지막 갱신:** 2026-05-06
> **대상:** Vercel production (`luminovel.ai`) + Supabase 프로젝트 `olpnuagrhidopfjjliih`
> **현 상태:** 코드 sync 완료 — 환경/Stripe/E2E 검증 미완

배포 직전 이 체크리스트를 위에서 아래로 한 번 통과시키세요. 🔴 항목은 통과 못 하면 배포 금지.

---

## 🔴 Critical — Deploy 전 반드시 (Hard Blocker)

### 1. `.env.production` 새 Supabase 프로젝트 키로 갱신

현재 파일에 옛 프로젝트(`zwoyfqsavcghftbmijdc`) URL + 그 프로젝트로 서명된 anon/service_role JWT가 박혀 있음. 새 프로젝트(`olpnuagrhidopfjjliih`)로 갱신 필요.

새로 채울 4개 값 (모두 새 프로젝트의 값):
- [ ] `NEXT_PUBLIC_SUPABASE_URL=https://olpnuagrhidopfjjliih.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` (새 프로젝트 anon JWT)
- [ ] `SUPABASE_SERVICE_ROLE_KEY=...` (새 프로젝트 service_role JWT)
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` (새 프로젝트의 webhook endpoint에 발급된 시그니처)

확인 방법: JWT를 jwt.io에 붙여 `iss="supabase"`, `ref="olpnuagrhidopfjjliih"` 인지 확인.

Vercel 사용 중이라면 `.env.production` 파일이 아니라 Vercel Project → Settings → Environment Variables에서 동일하게 갱신.

### 2. 새 Supabase 프로젝트에 022~031 마이그레이션 적용 확인

이번 세션에 추가한 마이그레이션:
| # | 파일 | 내용 |
|---|---|---|
| 022 | `admin_audit_log_and_ban.sql` | admin 감사 로그 + 정지 컬럼 |
| 023 | `moderation_flags.sql` | 모더레이션 큐 |
| 024 | `persona_projects.sql` | 페르소나 프로젝트(폴더) |
| 025 | `lumin_events.sql` | LUMIN 캘린더 |
| 026 | `user_attribution.sql` | UTM 컬럼 |
| 027 | `influencer_crm.sql` | 인플루언서 |
| 028 | `scenario_review.sql` | review_status 게이트 |
| 029 | `experiments.sql` | A/B 실험 |
| 030 | `onboarding_variant.sql` | 온보딩 variant 컬럼 |
| 031 | `founders_edition.sql` | founders_edition tier + founders_number(1–100) + claim_founders_number RPC |

확인:
```sql
SELECT version FROM supabase_migrations.schema_migrations
 WHERE version >= '022' ORDER BY version;
-- 022..031 10개 row가 보여야 함
```

### 3. Stripe 상품/가격 객체 (Live 모드)

`getOrCreatePrice` 함수가 첫 호출에 lazy-create 하긴 하지만, **첫 사용자가 결제 페이지에 들어간 순간 Live Stripe API에 진짜 product/price가 만들어진다**. 의도한 게 아니면 미리 수동 생성 권장.

확인할 lookup_key (3rd Pivot 후 v2 catalog):
- [ ] `lumin_pass_monthly_v2` ($49/mo, recurring monthly) — 신가 PASS
- [ ] `lumin_pass_yearly_v2` ($490/yr, recurring yearly) — 신가 PASS Annual
- [ ] `standard_monthly` ($19/mo, recurring monthly)
- [ ] `standard_yearly` ($190/yr, recurring yearly)
- [ ] **`founders_edition` ($499 one-time, mode=payment) — 100석 한정 NEW**

Legacy keys (grandfathered 구독자만, 신규 결제 차단됨):
- `lumin_pass_monthly` ($99/mo) — 기존 구독자 자동 갱신만
- `lumin_pass_yearly` ($990/yr) — 동일
- `welcome_lumin_pass_monthly` ($49.50/mo) — Welcome Offer 폐기됨, 라우트 410 Gone

Stripe 대시보드 Products → Prices에서 lookup_key 검색으로 확인. 없으면 첫 결제 시 자동 생성됨.

### 4. `npm run build` (production build) 통과

지금까지 dev server + `tsc --noEmit`만 했음. 실제 prod 빌드는 안 돌렸음.

```bash
rm -rf .next
npm run build
```

- [ ] 빌드 성공 (exit 0)
- [ ] static page generation 에러 없음
- [ ] `.next/types/validator.ts` 캐시에서 deleted-route 참조 사라짐

만약 실패하면 deploy 직전 캐시 잔재 처리 필요.

---

## 🟡 동작 검증 — HTTP 200 ≠ 작동

지금까지 확인한 건 status code뿐. 아래는 실제 사용자 흐름으로 검증해야 함.

### 5. End-to-end 결제 플로우 (Stripe Test Mode)

#### 5a. PASS v2 ($49) 구독
1. [ ] 새 계정으로 가입 (Google OAuth)
2. [ ] `/api/subscriptions/checkout` GET → plans 목록에 `lumin_pass_monthly_v2` 포함, legacy keys 미포함
3. [ ] PASS v2 결제 (Stripe test card `4242 4242 4242 4242`)
4. [ ] webhook 수신 후:
   - [ ] `users.subscription_tier='lumin_pass'`
   - [ ] `users.is_premium=true`
   - [ ] `subscriptions` 테이블에 row (`plan_id='lumin_pass_monthly_v2'`)
5. [ ] `/admin/subscriptions` 에 새 구독 표시 ($49)

#### 5b. Founders Edition ($499 one-time) ✨ NEW
1. [ ] `/api/subscriptions/founders` GET → `available:true, remaining:100`
2. [ ] POST → checkout URL 받음
3. [ ] 결제 완료 (Stripe test card)
4. [ ] webhook 수신 후:
   - [ ] `users.subscription_tier='founders_edition'`
   - [ ] `users.founders_number` ∈ [1, 100] (가장 작은 미점유 번호)
   - [ ] `users.is_premium=true`
   - [ ] `users.premium_expires_at ≈ NOW() + 365 days`
   - [ ] `purchases` 테이블에 row (`type='founders_edition'`, `stripe_session_id`)
5. [ ] 같은 유저로 재시도 → 400 ("You already own Founders Edition")
6. [ ] 100명 채운 후 101번째 시도 → 410 Gone
7. [ ] **동시성 테스트:** 동일 유저로 webhook 재발사 → `founders_number` 변경 안 됨 (idempotent)

#### 5c. Welcome Offer 폐기 확인
1. [ ] `/api/subscriptions/welcome-offer` GET → `{ eligible: false, deprecated: true }`
2. [ ] POST → 410 Gone

### 6. 모더레이션 차단

- [ ] 채팅에 한국어 19+ 단어 입력 → HTTP 422 + 친절한 안내 메시지
- [ ] 채팅에 `BTS`, `BLACKPINK` 같은 실명 아이돌 → HTTP 422
- [ ] `moderation_flags` 테이블에 `metadata.blocked=true` row 적재
- [ ] `/admin/moderation` 큐에 표시

### 7. Review_status 게이트

1. [ ] admin/scenarios로 새 시나리오 생성 (`is_active=true`로 두되 `review_status='draft'`)
2. [ ] 사용자 화면에서 해당 시나리오가 `getAvailableScenarios`에 안 나옴 (확인)
3. [ ] `/admin/publish-queue`에서 submit → approve
4. [ ] 사용자 화면에서 시나리오 등장

### 8. Admin 운영 액션 + audit log

- [ ] `/admin/users/<id>` 토큰 +100 (사유: "테스트") → 잔액 갱신 + `admin_audit_log` 1 row
- [ ] 정지 → 해제 → audit_log 2 rows

### 9. Stripe 환불 발사

Stripe test mode에서 활성 구독 1건 만든 뒤:
- [ ] `/admin/subscriptions/<id>` → 환불 버튼 → "REFUND" 입력 → 즉시 해지
- [ ] Stripe 대시보드에 refund 표시
- [ ] `purchases` 테이블에 negative-amount row
- [ ] `users.subscription_tier='free'` 복귀
- [ ] `admin_audit_log`에 refund row

---

## 🟠 데이터 마이그레이션

### 10. 기존 `is_premium`/`subscription_tier` 불일치 백필

```sql
-- 옛 모델로 가입한 유저는 is_premium=true / subscription_tier='free' 상태일 수 있음.
-- subscription_tier를 webhook 로직에 맞춰 보정.
UPDATE public.users u
SET subscription_tier = COALESCE(
    (SELECT CASE
       WHEN s.plan_id LIKE 'lumin_pass%' OR s.plan_id LIKE 'welcome_lumin_pass%' THEN 'lumin_pass'
       WHEN s.plan_id LIKE 'standard%' THEN 'standard'
       WHEN s.plan_id LIKE '%vip%' THEN 'lumin_pass'
       WHEN s.plan_id LIKE '%pro%' THEN 'standard'
       ELSE 'free'
     END
     FROM public.subscriptions s
     WHERE s.user_id = u.id AND s.status IN ('active','trialing')
     LIMIT 1),
    'free')
WHERE (u.is_premium = true AND u.subscription_tier = 'free')
   OR (u.is_premium = false AND u.subscription_tier <> 'free');
```

- [ ] 영향 받은 row 수 확인
- [ ] 무관한 row가 안 변경됐는지 spot check

### 11. 옛 토큰 IAP 사용자 처리 정책 결정

옛 프로젝트에 토큰 패키지 구매한 유저가 있다면 어떻게 할지:
- [ ] 옛 프로젝트는 폐기 → 새 프로젝트는 깨끗한 시작 (가장 간단)
- [ ] 옛 잔액 마이그레이션 → 1회성 SQL 작성 필요

### 12. 옛 캐릭터 컬럼 정리 (선택)

`persona_core`에 옛 다크 로맨스 personas (Daniel/Adrian/etc.) 데이터가 남아있는지 확인. LUMIN 7명만 `is_active=true`로 운영하고 나머지는 비활성화.

```sql
SELECT id, name, is_active FROM persona_core
WHERE id NOT IN ('haeon','kael','ren','jun','adrian','sol','noa');
```

- [ ] 비-LUMIN row는 `is_active=false` 또는 삭제

---

## 🔵 운영 안전망 (배포 후 모니터링)

### 13. Supabase Advisor lints

- [ ] `mcp__supabase__get_advisors` 실행 → ERROR 0건 유지
- 현재 4개 WARN: vector extension in public, authenticated SECURITY DEFINER × 2 (intended), leaked password protection (대시보드 토글)

### 14. Stripe webhook 재발사 확인

만약 6단계에서 webhook이 fire 안 됐다면:
- [ ] Stripe → Webhooks → 해당 endpoint → "Resend" 가능
- [ ] webhook signature 검증은 `STRIPE_WEBHOOK_SECRET` 일치 시에만 통과

### 15. 첫 Sentry/error_logs 모니터링

배포 직후 1시간:
- [ ] `/admin/logs?status=open` 이 경로에서 새 에러 streaming
- [ ] 알 수 없는 에러 5건 이상이면 rollback 고려

### 16. LLM 비용 가시성

배포 직후 24시간:
- [ ] `/admin/llm-usage` 일별 USD 차트가 비정상 급증 안 함 (한도 알림 임계값 정해두기)

---

## 🟢 이미 정렬된 항목 (참고용)

배포 전 별도 작업 불필요:

- ✅ 코드와 docs sync (P0/P1/P2/Sync 9개 마이그 + 30+ admin route)
- ✅ Hard Rules 차단·lint·게이트 (사전 user_message 차단 + 사후 ai_response 교체 + 시스템 프롬프트 주입)
- ✅ TypeScript clean
- ✅ admin requireAdmin() 113곳 적용
- ✅ admin_audit_log 모든 write 자동 기록
- ✅ 다크 로맨스 잔재 정리 (PHANTOM/Daniel Sterling/CEO/yakuza/코인 가격표)
- ✅ SEO metadata + JSON-LD LUMIN K-pop으로 재작성

---

## Run Book — 실제 명령

### A. 새 환경 키 swap
```bash
# .env.production 백업 후 4개 값 갱신
cp .env.production .env.production.bak
# (수동 편집)
```

### B. Supabase 마이그 적용 (이미 됐다면 skip)
```bash
# MCP 도구로 확인. CLI는 금지 (CLAUDE.md "npx supabase db push 금지")
# Claude Code 세션에서:
#   mcp__supabase__list_migrations(project_id='olpnuagrhidopfjjliih')
```

### C. Production build
```bash
rm -rf .next
npm run build
# 통과 후
npm run start  # 로컬에서 prod build 동작 확인
```

### D. 시나리오 lint regression
```bash
npm run lint:scenarios
# Hard Rules 위반 0건이어야 함
```

### E. Vercel deploy
```bash
git push origin main  # auto-deploy 설정 시
# 또는
vercel --prod
```

---

## 🚨 Rollback 절차

배포 후 critical 버그 발견 시:

1. Vercel: 이전 deployment를 promote
2. DB: 마이그 022~031은 idempotent. ROLLBACK이 필요한 마이그는 028(review_status), 030(onboarding_variant), 031(founders_edition) 정도이며 DROP COLUMN/CONSTRAINT/FUNCTION으로 되돌릴 수 있음
3. Stripe: 이미 결제된 건은 환불로만 처리 — DB 변경으로 무효화 금지
4. webhook: `STRIPE_WEBHOOK_SECRET`은 그대로 유지 (secret 회전은 별개 작업)

---

## 책임자

- 코드/마이그: Claude Opus 4.7 (이번 세션)
- 환경 키/Stripe/배포: 운영자 (이 문서 따라 수동)
- 첫 결제 monitoring: 운영자 + admin 대시보드

배포 시작 전 이 문서 위에서 아래로 한 번 더 읽고 🔴 4건 통과 확인.
