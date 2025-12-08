# 튜토리얼 시스템 분석 및 개선 계획

## 📊 현재 구현 상태 요약

| 튜토리얼 | 상태 | 완성도 | 비고 |
|----------|------|--------|------|
| **Initial Tutorial** | ✅ 완료 | 100% | 메인 페이지 진입 시 |
| **DM Tutorial** | ❌ 미구현 | 0% | 정의만 됨 |
| **Scenario Tutorial** | ❌ 미구현 | 0% | 정의만 됨 |
| **Suggested Friends Tutorial** | ❌ 없음 | 0% | 정의 필요 |
| **Profile/Relationship Tutorial** | ❌ 없음 | 0% | 정의 필요 |

**전체 완성도: ~20%** (1/5 튜토리얼 작동)

---

## 🎯 서비스 플로우 & 필요 튜토리얼

```
[온보딩] → [가입] → [팔로우 5명 선택]
                          ↓
                    [메인 홈페이지]
                          │
    ┌─────────────────────┼─────────────────────┐
    ↓                     ↓                     ↓
[홈 피드]            [DM 목록]            [프로필]
    │                     │                     │
    │              ┌──────┴──────┐              │
    │              ↓             ↓              │
    │       [추천 팔로우]    [DM 채팅]          │
    │              │             │              │
    │              │             ↓              │
    │              │       [시나리오]           │
    │              │                            │
    └──────────────┴────────────────────────────┘
```

### 필요한 튜토리얼 5개

| # | 튜토리얼 | 트리거 시점 | 목적 |
|---|----------|-------------|------|
| 1 | **Initial Tutorial** | 메인 페이지 첫 진입 | 앱 기본 네비게이션 안내 |
| 2 | **Suggested Friends Tutorial** | DM 목록 첫 방문 | 추천 팔로우 기능 안내 |
| 3 | **DM Tutorial** | 첫 DM 채팅방 진입 | 채팅 방법 안내 |
| 4 | **Scenario Tutorial** | 첫 시나리오 플레이 | 시나리오 조작 안내 |
| 5 | **Profile Tutorial** | 첫 프로필 방문 | 관계/private 탭 안내 |

---

## 🏗️ 시스템 아키텍처 (기존)

### Tutorial Store
**파일:** [lib/stores/tutorial-store.ts](../lib/stores/tutorial-store.ts)

- Zustand 기반 상태 관리
- localStorage 영속성 (`tutorial-storage`)
- 완료된 튜토리얼 자동 스킵

### SpotlightTutorial
**파일:** [components/tutorial/SpotlightTutorial.tsx](../components/tutorial/SpotlightTutorial.tsx)

- 포커스 하이라이트 (radial-gradient)
- 스마트 툴팁 위치 계산
- auto/click 진행 모드

### useTutorial Hook
**파일:** [components/tutorial/useTutorial.ts](../components/tutorial/useTutorial.ts)

```typescript
// 현재 제공 함수
startInitialTutorial()      // ✅ 사용 중
startDMTutorial()           // ❌ 미사용
startScenarioTutorial()     // ❌ 미사용
// 추가 필요
startSuggestedFriendsTutorial()  // 새로 추가
startProfileTutorial()           // 새로 추가
```

---

## ✅ 구현 완료: Initial Tutorial

**파일:** [app/(marketing)/page.tsx](../app/(marketing)/page.tsx)

| 스텝 | 타겟 | 메시지 | 진행 |
|------|------|--------|------|
| 1 | `[data-tutorial="home-feed"]` | 피드 소개 | auto 3.5초 |
| 2 | `[data-tutorial="home-button"]` | 홈 버튼 | auto 2.5초 |
| 3 | `[data-tutorial="dm-button"]` | DM 버튼 | click |
| 4 | `[data-tutorial="profile-button"]` | 프로필 버튼 | click |

---

## ❌ 추가 필요: Suggested Friends Tutorial

**트리거 위치:** DM 목록 페이지 (DMList 또는 메인 페이지 DM 탭)

**파일:** [components/dm/SuggestedFriends.tsx](../components/dm/SuggestedFriends.tsx)

### 튜토리얼 정의 (추가 필요)

```typescript
export const SUGGESTED_FRIENDS_TUTORIAL: TutorialSequence = {
  id: 'suggested-friends-tutorial',
  name: '추천 친구 사용법',
  steps: [
    {
      id: 'suggested-list',
      targetSelector: '[data-tutorial="suggested-friends-list"]',
      message: '여기서 새로운 캐릭터를 만날 수 있어요!',
      subMessage: '팔로우하면 DM을 보낼 수 있어요',
      position: 'top',
      advanceOn: 'auto',
      autoDelay: 3000,
      padding: 8,
    },
    {
      id: 'follow-button',
      targetSelector: '[data-tutorial="follow-button"]',
      message: '팔로우 버튼을 눌러 친구가 되어보세요',
      subMessage: '토큰이 필요해요',
      position: 'top',
      advanceOn: 'click',
      padding: 8,
    },
    {
      id: 'refresh-button',
      targetSelector: '[data-tutorial="refresh-button"]',
      message: '다른 캐릭터를 보고 싶다면 새로고침!',
      subMessage: '무료 새로고침은 5분마다 가능해요',
      position: 'top',
      advanceOn: 'click',
      padding: 8,
    },
  ],
};
```

### data-tutorial 속성 추가 위치

| 속성 | 파일 | 위치 |
|------|------|------|
| `data-tutorial="suggested-friends-list"` | `SuggestedFriends.tsx` | 355줄 추천 목록 컨테이너 |
| `data-tutorial="follow-button"` | `SuggestedFriends.tsx` | 405줄 첫 팔로우 버튼 |
| `data-tutorial="refresh-button"` | `SuggestedFriends.tsx` | 294줄 무료 새로고침 버튼 |

---

## ❌ 추가 필요: Profile/Relationship Tutorial

**트리거 위치:** 프로필 페이지 첫 방문

**파일:** [app/profile/[personaId]/page.tsx](../app/profile/[personaId]/page.tsx)

### 튜토리얼 정의 (추가 필요)

```typescript
export const PROFILE_TUTORIAL: TutorialSequence = {
  id: 'profile-tutorial',
  name: '프로필 사용법',
  steps: [
    {
      id: 'profile-stats',
      targetSelector: '[data-tutorial="profile-stats"]',
      message: '캐릭터의 인기도를 확인할 수 있어요',
      position: 'bottom',
      advanceOn: 'auto',
      autoDelay: 2500,
      padding: 8,
    },
    {
      id: 'message-button',
      targetSelector: '[data-tutorial="message-button"]',
      message: '메시지 버튼으로 DM을 보낼 수 있어요',
      position: 'top',
      advanceOn: 'auto',
      autoDelay: 2500,
      padding: 8,
    },
    {
      id: 'private-tab',
      targetSelector: '[data-tutorial="private-tab"]',
      message: '비밀 게시물은 관계가 깊어지면 볼 수 있어요',
      subMessage: '해킹 레벨을 올려보세요!',
      position: 'top',
      advanceOn: 'click',
      padding: 8,
    },
  ],
};
```

### data-tutorial 속성 추가 위치

| 속성 | 파일 | 위치 |
|------|------|------|
| `data-tutorial="profile-stats"` | `profile/[personaId]/page.tsx` | 239줄 통계 섹션 |
| `data-tutorial="message-button"` | `profile/[personaId]/page.tsx` | 279줄 메시지 버튼 |
| `data-tutorial="private-tab"` | `profile/[personaId]/page.tsx` | 313줄 PRIVATE 탭 |

---

## ❌ 기존 정의 구현 필요: DM Tutorial

**파일:** [lib/tutorial-data.ts](../lib/tutorial-data.ts) (이미 정의됨)

| 스텝 | 타겟 | 메시지 | 진행 |
|------|------|--------|------|
| 1 | `[data-tutorial="dm-list"]` | DM 목록 설명 | auto 3초 |
| 2 | `[data-tutorial="dm-chat-input"]` | 채팅 입력 안내 | click |

### 필요 작업

1. **트리거 로직** - `app/dm/[personaId]/page.tsx` 또는 `components/sns/DMChat.tsx`
2. **data-tutorial 속성** - `components/sns/DMChat.tsx`

---

## ❌ 기존 정의 구현 필요: Scenario Tutorial

**파일:** [lib/tutorial-data.ts](../lib/tutorial-data.ts) (이미 정의됨)

| 스텝 | 타겟 | 메시지 | 진행 |
|------|------|--------|------|
| 1 | `[data-tutorial="scenario-text"]` | 탭하여 진행 | auto 3초 |
| 2 | `[data-tutorial="scenario-choices"]` | 선택지 안내 | click |

### 필요 작업

1. **트리거 로직** - `components/scenario/ScenarioPlayer.tsx`
2. **data-tutorial 속성** - `components/scenario/ScenarioPlayer.tsx`

---

## 🛠️ 구현 작업 목록

### Phase 1: 튜토리얼 정의 추가

| # | 작업 | 파일 |
|---|------|------|
| 1 | SUGGESTED_FRIENDS_TUTORIAL 정의 추가 | `lib/tutorial-data.ts` |
| 2 | PROFILE_TUTORIAL 정의 추가 | `lib/tutorial-data.ts` |
| 3 | useTutorial 훅에 새 함수 추가 | `components/tutorial/useTutorial.ts` |

### Phase 2: data-tutorial 속성 추가

| # | 작업 | 파일 |
|---|------|------|
| 4 | 추천 친구 속성 추가 | `components/dm/SuggestedFriends.tsx` |
| 5 | 프로필 속성 추가 | `app/profile/[personaId]/page.tsx` |
| 6 | DM 채팅 속성 추가 | `components/sns/DMChat.tsx` |
| 7 | 시나리오 속성 추가 | `components/scenario/ScenarioPlayer.tsx` |

### Phase 3: 트리거 로직 추가

| # | 작업 | 파일 |
|---|------|------|
| 8 | 추천 친구 튜토리얼 트리거 | `components/dm/DMList.tsx` |
| 9 | 프로필 튜토리얼 트리거 | `app/profile/[personaId]/page.tsx` |
| 10 | DM 튜토리얼 트리거 | `app/dm/[personaId]/page.tsx` |
| 11 | 시나리오 튜토리얼 트리거 | `components/scenario/ScenarioPlayer.tsx` |

---

## 📁 수정 파일 목록

### 새로 수정
- `lib/tutorial-data.ts` - 2개 튜토리얼 정의 추가
- `components/tutorial/useTutorial.ts` - 2개 함수 추가
- `components/dm/SuggestedFriends.tsx` - 속성 + 트리거
- `components/dm/DMList.tsx` - 트리거 로직
- `app/profile/[personaId]/page.tsx` - 속성 + 트리거

### 기존 문서화된 수정
- `components/sns/DMChat.tsx` - 속성 추가
- `app/dm/[personaId]/page.tsx` - 트리거 로직
- `components/scenario/ScenarioPlayer.tsx` - 속성 + 트리거

---

## ✅ 테스트 체크리스트

### Initial Tutorial ✅
- [x] 메인 페이지 첫 진입 시 시작
- [x] 4개 스텝 순차 진행
- [x] 완료 후 localStorage 저장
- [x] 재방문 시 스킵

### Suggested Friends Tutorial (구현 후)
- [ ] DM 목록 첫 방문 시 시작
- [ ] 추천 목록 하이라이트
- [ ] 팔로우 버튼 하이라이트
- [ ] 새로고침 버튼 하이라이트

### Profile Tutorial (구현 후)
- [ ] 프로필 첫 방문 시 시작
- [ ] 통계 섹션 하이라이트
- [ ] 메시지 버튼 하이라이트
- [ ] Private 탭 하이라이트

### DM Tutorial (구현 후)
- [ ] DM 채팅 첫 진입 시 시작
- [ ] 메시지 목록 하이라이트
- [ ] 입력창 하이라이트

### Scenario Tutorial (구현 후)
- [ ] 시나리오 첫 플레이 시 시작
- [ ] 텍스트 영역 하이라이트
- [ ] 선택지 하이라이트

---

*문서 업데이트: 2024-12-08*
*분석 도구: Claude Code*
