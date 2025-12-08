# 유저 첫 플로우 분석 및 개선 계획

## 📋 의도한 플로우

1. A/B 온보딩 페이지 진입
2. 온보딩 시나리오 제공해서 플레이 경험 제공
3. 가입
4. 팔로우 5명 선택 (유저 성향 결정: 남성향/여성향/애니)
5. 메인화면 진입
6. 포커싱 튜토리얼 진행 (눌러야 할 곳 포커싱하고 툴팁으로 기능 설명)
7. 포커싱 튜토리얼 완료하면 가입 축하 프로모션 결제 모달 오픈

---

## 📊 현재 구현 상태 요약

| 단계 | 컴포넌트 | 상태 | 완성도 | 핵심 이슈 |
|------|----------|------|--------|-----------|
| 1 | A/B 온보딩 | ✅ 완료 | 95% | 호감도 페르소나 하드코딩 |
| 2 | 시나리오 플로우 | ✅ 완료 | 100% | 없음 |
| 3 | OAuth 가입 | ✅ 완료 | 100% | 없음 |
| 4 | 팔로우 선택 | ✅ 완료 | 100% | 없음 |
| 5 | 메인화면 | ✅ 완료 | 100% | 없음 |
| 6 | 튜토리얼 | ✅ 완료 | 100% | 없음 |
| 7 | 웰컴 모달 | ⚠️ 시퀀스 이슈 | 85% | **튜토리얼 전에 뜸** |
| **전체** | - | ⚠️ 거의 완료 | **95%** | 모달 타이밍만 수정 필요 |

---

## 🔍 상세 분석

### 1. A/B 온보딩 시스템 ✅

**상태: 완료**

**관련 파일:**
- [app/onboarding/page.tsx](app/onboarding/page.tsx) - A/B 변형 선택 진입점
- [components/onboarding/variants/OnboardingA.tsx](components/onboarding/variants/OnboardingA.tsx) - 변형 A (심플 리스트)
- [components/onboarding/variants/OnboardingB.tsx](components/onboarding/variants/OnboardingB.tsx) - 변형 B (잠금화면)
- [components/onboarding/OnboardingFlow.tsx](components/onboarding/OnboardingFlow.tsx) - 핵심 플로우 오케스트레이션

**구현된 기능:**
- ✅ 두 가지 A/B 변형 (50/50 또는 DB 설정 가중치)
- ✅ 변형 A: 잠금화면 없이 바로 페르소나 선택
- ✅ 변형 B: iOS 스타일 잠금화면 + 알림 → 시나리오
- ✅ DB 기반 페르소나 fetching (fallback 포함)
- ✅ 호감도 트래킹

**⚠️ 개선 필요:**
- 호감도가 'jun' 페르소나로 하드코딩됨 (선택한 페르소나로 변경 필요)

---

### 2. OAuth 가입 플로우 ✅

**상태: 완료**

**관련 파일:**
- [app/login/page.tsx](app/login/page.tsx) - OAuth 로그인 (Google, Discord)
- [app/auth/callback/page.tsx](app/auth/callback/page.tsx) - OAuth 콜백 핸들러
- [components/onboarding/OnboardingSignup.tsx](components/onboarding/OnboardingSignup.tsx) - 가입 유도 페이지

**구현된 기능:**
- ✅ Google/Discord OAuth
- ✅ Implicit flow 및 PKCE flow 모두 지원
- ✅ 신규/기존 유저 구분
- ✅ 유저 테이블에 초기 데이터 upsert (토큰 100개 등)
- ✅ Analytics 연동 (Mixpanel identify/track)

**라우팅 로직:**
```
신규 유저 → /follow-personas
기존 유저 (팔로우 미완료) → /follow-personas
기존 유저 (팔로우 완료) → / (홈)
```

---

### 3. 팔로우 페르소나 선택 ✅

**상태: 완료**

**관련 파일:**
- [app/follow-personas/page.tsx](app/follow-personas/page.tsx)
- [app/api/onboarding/follow/route.ts](app/api/onboarding/follow/route.ts)

**구현된 기능:**
- ✅ 2단계 플로우: 카테고리 선택 → 페르소나 선택
- ✅ 타겟 오디언스 선택 (여성향/남성향/애니)
- ✅ 최소 5명 선택 강제
- ✅ 그리드 레이아웃 + 시각적 피드백
- ✅ `preferred_target_audience` 저장
- ✅ `initial_follows_completed` 플래그 설정
- ✅ 완료 시 `/?from_onboarding=true`로 리다이렉트

---

### 4. 메인화면 ✅

**상태: 완료**

**관련 파일:**
- [app/(marketing)/page.tsx](app/(marketing)/page.tsx) - 메인 홈페이지

**구현된 기능:**
- ✅ 로그인 체크 및 미인증 시 `/onboarding`으로 리다이렉트
- ✅ 탭 네비게이션 (home, dm, create, activity, profile)
- ✅ 세션 스토리지로 탭/스크롤 위치 복원
- ✅ 출석 체크 및 스트릭 보너스
- ✅ 토큰/레벨 표시
- ✅ `data-tutorial` 속성 적용됨

---

### 5. 튜토리얼 시스템 ✅

**상태: 완료**

**관련 파일:**
- [lib/stores/tutorial-store.ts](lib/stores/tutorial-store.ts) - Zustand 스토어
- [components/tutorial/TutorialProvider.tsx](components/tutorial/TutorialProvider.tsx) - 프로바이더
- [components/tutorial/SpotlightTutorial.tsx](components/tutorial/SpotlightTutorial.tsx) - 스포트라이트 구현
- [components/tutorial/useTutorial.ts](components/tutorial/useTutorial.ts) - 튜토리얼 훅
- [lib/tutorial-data.ts](lib/tutorial-data.ts) - 튜토리얼 정의

**구현된 기능:**
- ✅ 포커스/하이라이트 (방사형 그라데이션 오버레이)
- ✅ 자동 스크롤
- ✅ Z-index 관리 (z-10000)
- ✅ 툴팁 위치 계산 (상/하/좌/우)
- ✅ 화살표 인디케이터
- ✅ 스텝 인디케이터 (점)
- ✅ 진행 모드: `auto` (시간 후 자동), `click` (클릭 대기)
- ✅ localStorage 영속성

**튜토리얼 트리거 (메인 페이지 140-150줄):**
```typescript
// 로딩 완료 후 튜토리얼 시작 (처음 접속한 사용자만)
useEffect(() => {
  if (!isLoading && !tutorialStartedRef.current && !isInitialTutorialCompleted()) {
    tutorialStartedRef.current = true;
    const timer = setTimeout(() => {
      startInitialTutorial();
    }, 1000);
    return () => clearTimeout(timer);
  }
}, [isLoading, startInitialTutorial, isInitialTutorialCompleted]);
```

**정의된 튜토리얼 스텝 (INITIAL_TUTORIAL):**
1. 홈 피드 소개 (auto, 3.5초) - `[data-tutorial="home-feed"]`
2. 홈 버튼 소개 (auto, 2.5초) - `[data-tutorial="home-button"]`
3. DM 버튼 소개 (click) - `[data-tutorial="dm-button"]`
4. 프로필 버튼 소개 (click) - `[data-tutorial="profile-button"]`

**data-tutorial 속성 위치 (메인 페이지):**
- 347줄: `<main data-tutorial="home-feed">`
- 384줄: 각 네비게이션 버튼에 `data-tutorial={tutorialId}` 적용

---

### 6. 웰컴 프로모션 모달 ⚠️

**상태: 구현 완료, 타이밍 수정 필요**

**관련 파일:**
- [components/modals/WelcomeOfferModal.tsx](components/modals/WelcomeOfferModal.tsx) - 메인 모달
- [components/modals/WelcomeOfferFloatingCTA.tsx](components/modals/WelcomeOfferFloatingCTA.tsx) - 플로팅 버튼
- [components/providers/WelcomeOfferProvider.tsx](components/providers/WelcomeOfferProvider.tsx) - 프로바이더
- [hooks/useWelcomeOffer.ts](hooks/useWelcomeOffer.ts) - 자격 확인 훅

**구현된 기능:**
- ✅ 24시간 카운트다운 타이머
- ✅ 70% 할인 (연간 $29.99, 월간 $2.99)
- ✅ 보너스 크레딧 (연간 6000, 월간 500)
- ✅ Confetti 효과
- ✅ 플랜 선택 UI
- ✅ 이탈 방지 확인 모달
- ✅ 플로팅 CTA (닫기 후 표시)

**⚠️ 문제: 현재 트리거 로직 (WelcomeOfferProvider 79-113줄)**
```typescript
// 현재: from_onboarding=true 또는 shouldAutoOpen() 시 1.5초 후 즉시 모달 표시
if (fromOnboarding || shouldAutoOpen()) {
  const timer = setTimeout(() => {
    openModal();
    setHasShownOnce(true);
  }, 1500);  // ← 튜토리얼보다 먼저 뜸!
}
```

**의도한 동작:**
- 튜토리얼 완료 **후**에 모달 표시
- 현재는 튜토리얼 시작 1초 + 모달 1.5초로 거의 동시에 뜸

---

## 🚨 수정 필요 사항

### 1. 웰컴 모달 타이밍 (Priority: HIGH)

**현재 타임라인:**
```
0ms    - 페이지 로드
1000ms - 튜토리얼 시작
1500ms - 웰컴 모달 표시 ❌ (튜토리얼 중에 뜸)
```

**의도한 타임라인:**
```
0ms    - 페이지 로드
1000ms - 튜토리얼 시작
~15초  - 튜토리얼 완료 (4스텝)
+500ms - 웰컴 모달 표시 ✅
```

**수정 방안:**
1. `WelcomeOfferProvider`에서 튜토리얼 완료 상태 체크
2. `from_onboarding` 시 즉시 열지 말고, 튜토리얼 완료 후 열기
3. 또는 메인 페이지에서 튜토리얼 완료 콜백으로 모달 열기

---

### 2. 온보딩 호감도 페르소나 하드코딩 (Priority: LOW)

**위치:** `components/onboarding/OnboardingSignup.tsx` 54줄
```typescript
persona_id: 'jun',  // ← 선택한 페르소나로 변경 필요
```

---

## 📐 전체 플로우 다이어그램

```
시작
  ↓
[/onboarding] - A/B 테스트 진입
  ├─ 변형 A (50%): 잠금화면 없음
  │   └─ 페르소나 선택 → 시나리오 → 가입 유도 → OAuth
  │
  └─ 변형 B (50%): 잠금화면
      └─ 알림 → 시나리오 → 가입 유도 → OAuth

  ↓ (OAuth 로그인)

[/auth/callback] - OAuth 핸들러
  └─ 유저 생성, initial_follows_completed 확인

  ↓
  ├─ 신규 유저 → [/follow-personas]
  │   └─ 카테고리 선택 → 페르소나 그리드 (최소 5명)
  │   └─ 관계 생성, preferred_target_audience 설정
  │   └─ 리다이렉트: /?from_onboarding=true
  │
  └─ 기존 유저 → [/]

  ↓

[/] 메인 페이지 (app/(marketing)/page.tsx)
  └─ 로그인 체크 (미인증 → /onboarding)
  └─ 튜토리얼 시작 (1초 후, 미완료 시)

  ↓

튜토리얼 (INITIAL_TUTORIAL) - 약 15초
  ├─ 피드 소개 (auto, 3.5초)
  ├─ 홈 버튼 (auto, 2.5초)
  ├─ DM 버튼 (click)
  └─ 프로필 버튼 (click)

  ↓ (튜토리얼 완료)

[⚠️ 수정 필요] 웰컴 오퍼 모달
  └─ 70% 할인, 24시간 카운트다운
  └─ 최소화 시 플로팅 CTA

  ↓

메인 앱 콘텐츠 사용
```

---

## 🛠️ 수정 작업 목록

| # | 작업 | 우선순위 | 파일 |
|---|------|----------|------|
| 1 | 웰컴 모달을 튜토리얼 완료 후로 지연 | 🔴 HIGH | `components/providers/WelcomeOfferProvider.tsx` |
| 2 | 온보딩 호감도를 선택된 페르소나로 변경 | 🟢 LOW | `components/onboarding/OnboardingSignup.tsx` |

---

## ✅ 테스트 체크리스트

플로우 수정 후 테스트할 항목:

### 온보딩 → 가입
- [ ] 온보딩 A 변형 진입 → 시나리오 → 가입
- [ ] 온보딩 B 변형 진입 → 시나리오 → 가입
- [ ] OAuth 로그인 (Google)
- [ ] OAuth 로그인 (Discord)

### 팔로우 선택
- [ ] 팔로우 페르소나 카테고리 선택
- [ ] 팔로우 페르소나 5명 미만 선택 시 버튼 비활성화
- [ ] 팔로우 완료 후 홈으로 리다이렉트

### 튜토리얼 → 웰컴 모달
- [ ] 홈에서 튜토리얼 자동 시작 (신규 유저)
- [ ] 튜토리얼 각 스텝 진행
- [ ] **튜토리얼 완료 후 웰컴 모달 표시** (수정 후)
- [ ] 웰컴 모달 닫기 → 플로팅 CTA 표시

### 기존 유저
- [ ] 기존 유저 로그인 시 튜토리얼/모달 스킵

---

*문서 생성일: 2024-12-08*
*분석 도구: Claude Code*
