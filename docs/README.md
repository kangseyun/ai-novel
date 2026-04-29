# Luminovel Docs

> **마지막 정리:** 2026-04-29
> **방향:** K-pop 가상 아이돌 LUMIN / 클린(전연령) / $99 PASS 10명 = $990 MRR

## 📚 6개 핵심 문서 + 1 인덱스

| 문서 | 목적 | 누가 읽을까 |
|---|---|---|
| [`STRATEGY.md`](./STRATEGY.md) | 피벗 / 가격 / GTM / 단위경제 | 비즈니스, 마케팅, PM |
| [`LUMIN.md`](./LUMIN.md) | 그룹 IP + 멤버 7인 + 케미 + 톤 가이드 | 콘텐츠 라이터, 디자이너, AI 프롬프트 작성자 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 시스템 / 데이터 모델 / 유저 플로우 / 튜토리얼 / 기술 개선 체크리스트 | 엔지니어 |
| [`SCENARIO_SYSTEM.md`](./SCENARIO_SYSTEM.md) | 시나리오 엔진 v2 (Static/Guided/Dynamic) + 이벤트 트리거 | 콘텐츠 라이터, 엔지니어 |
| [`API_DESIGN.md`](./API_DESIGN.md) | API 엔드포인트 스펙 | 엔지니어, 통합 작업자 |

루트:
- [`/CLAUDE.md`](../CLAUDE.md) — Claude Code AI 가이드
- [`/GEMINI.md`](../GEMINI.md) — Gemini AI 가이드
- [`/STRIPE_SETUP.md`](../STRIPE_SETUP.md) — Stripe 결제 셋업

## 🗺️ 읽기 순서

### 신규 합류자
1. `/CLAUDE.md` — 프로젝트 한 페이지
2. `STRATEGY.md` — 왜 / 무엇을 / 어떻게 팔지
3. `LUMIN.md` — IP 정체성
4. `ARCHITECTURE.md` — 코드 구조

### 비즈니스/마케팅
- `STRATEGY.md` 만 읽으면 충분

### 콘텐츠 라이터
- `LUMIN.md` + `SCENARIO_SYSTEM.md`

### 엔지니어
- `ARCHITECTURE.md` + `API_DESIGN.md` + `SCENARIO_SYSTEM.md`

## 📋 정리 이력

**2026-04-29 — 통합 정리** (36개 → 6개 문서)
- 신규 통합: `STRATEGY.md` (← pivot 3개), `LUMIN.md` (← group/LUMIN_GROUP + members 7개), `ARCHITECTURE.md` (← architecture 3개 + USER_FLOW + TUTORIAL)
- `scenario-system-v2.md` → `SCENARIO_SYSTEM.md` 이름 변경
- `API_DESIGN.md` 유지
- 삭제: 옛 페르소나 5개, 옛 시나리오 6개, MVP_PLAN, MARKETING_STRATEGY, TARGET_PERSONA, README(템플릿), MIXPANEL_INSTALLATION
- 토큰 효율: 36개 동시 로드 → 6개 분류 로드로 약 70% 감축

**2026-04-29 — 피벗 반영**
- 25개 모순 정리 (캐릭터 IP, 가격 모델, 19+ 콘텐츠 잔재, OAuth/LLM/화폐/관계 단계 표기 등 통일)
- 옛 다크 로맨스 컨셉 → K-pop 가상 아이돌 LUMIN으로 전환
