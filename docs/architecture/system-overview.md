# AI Novel System Architecture

## Overview

이 문서는 AI Novel 앱의 전체 시스템 아키텍처를 설명합니다.

---

## 1. 핵심 개념

### 1.1 Origin Persona (원본 페르소나)
- **정의**: 콘텐츠팀이 작성한 불변의 캐릭터 데이터
- **특징**: 절대 변하지 않음
- **테이블**: `persona_core`, `personas`, `scenario_templates`

### 1.2 User Instance (유저 인스턴스)
- **정의**: 유저별로 진화하는 관계 데이터
- **특징**: 대화/시나리오에 따라 변화
- **테이블**: `user_persona_relationships`, `persona_memories`, `user_journey_stats`

---

## 2. 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│  SNS Feed  │  DM Chat  │  Scenario Player  │  Profile  │  Shop     │
└──────┬──────────┬────────────┬────────────────┬────────────┬────────┘
       │          │            │                │            │
       ▼          ▼            ▼                ▼            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer (Next.js API Routes)              │
├─────────────────────────────────────────────────────────────────────┤
│  /api/ai/chat  │  /api/dm/*  │  /api/scenario/*  │  /api/personas/*│
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AI Agent System (lib/ai-agent/)             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   AIAgent       │  │  LLMClient      │  │  PersonaLoader  │     │
│  │   (Core)        │  │  (OpenAI/Claude)│  │  (Origin Data)  │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                     │              │
│  ┌────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐     │
│  │ MemoryManager   │  │ ScenarioService │  │ EventTrigger    │     │
│  │ (기억 저장)      │  │ (시나리오 관리)  │  │ Service (이벤트)│     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase (PostgreSQL)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Origin Persona (불변)          User Instance (변경 가능)            │
│  ┌─────────────────┐           ┌─────────────────┐                  │
│  │ persona_core    │           │ user_persona_   │                  │
│  │ personas        │           │ relationships   │                  │
│  │ scenario_       │           │ persona_memories│                  │
│  │ templates       │           │ user_journey_   │                  │
│  │ event_trigger_  │           │ stats           │                  │
│  │ rules           │           │ scheduled_events│                  │
│  └─────────────────┘           └─────────────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 핵심 플로우

### 3.1 DM 대화 플로우

```
1. 유저가 메시지 입력
   ↓
2. /api/ai/chat 호출
   ↓
3. AIAgent.processMessage()
   ├── 세션 조회/생성
   ├── 컨텍스트 구성 (페르소나 + 관계 + 기억)
   ├── LLM 응답 생성
   ├── 메시지 저장
   ├── 관계 상태 업데이트
   ├── 기억 추출 및 저장
   └── scenarioTrigger 체크
   ↓
4. 응답 반환 (+ 선택지)
   ↓
5. scenarioTrigger가 있으면
   → 시나리오 전환 모달 표시
```

### 3.2 시나리오 플로우

```
1. DM에서 scenarioTrigger 발생 OR 직접 시나리오 시작
   ↓
2. /scenario 페이지로 이동
   ↓
3. ScenarioPlayer 렌더링
   ├── 씬 표시 (내레이션, 대화, 배경)
   ├── 선택지 표시
   ├── 유저 선택
   └── 다음 씬으로 이동
   ↓
4. 시나리오 완료
   ├── ScenarioService.completeScenario()
   ├── 호감도 업데이트
   ├── 메모리 저장 (첫 만남 등)
   ├── 마일스톤 기록
   └── 여정 통계 업데이트
   ↓
5. DM으로 복귀
```

### 3.3 이벤트 트리거 플로우

```
1. 백그라운드 작업 (Cron/Edge Function)
   ↓
2. EventTriggerService.evaluateAndTrigger()
   ├── 활성 규칙 조회
   ├── 유저 상태 조회 (호감도, 관계, 마지막 활동)
   ├── 조건 평가
   ├── 확률 계산
   └── 트리거 결정
   ↓
3. 이벤트 스케줄링
   ├── scheduled_events에 저장
   └── 전달 시간 설정
   ↓
4. 이벤트 전달
   ├── 푸시 알림 OR
   ├── DM 메시지 OR
   └── 피드 게시물
```

---

## 4. 데이터 모델

### 4.1 Origin Persona Tables

| 테이블 | 설명 |
|--------|------|
| `personas` | 페르소나 기본 정보 (이름, 아바타, 카테고리) |
| `persona_core` | 페르소나 상세 설정 (성격, 말투, 행동 패턴) |
| `scenario_templates` | 시나리오 마스터 데이터 |
| `event_trigger_rules` | 이벤트 트리거 규칙 |

### 4.2 User Instance Tables

| 테이블 | 설명 |
|--------|------|
| `user_persona_relationships` | 유저-페르소나 관계 (호감도, 단계) |
| `persona_memories` | 유저와의 기억 |
| `user_journey_stats` | 여정 통계 |
| `relationship_milestones` | 관계 마일스톤 |
| `user_scenario_progress` | 시나리오 진행 상태 |
| `scheduled_events` | 예약된 이벤트 |
| `user_event_state` | 유저별 이벤트 상태 |

### 4.3 Interaction Tables

| 테이블 | 설명 |
|--------|------|
| `conversation_sessions` | 대화 세션 |
| `conversation_messages` | 대화 메시지 |
| `conversation_summaries` | 대화 요약 |

---

## 5. 주요 서비스

### 5.1 AIAgent (`lib/ai-agent/ai-agent.ts`)
- 메인 AI 에이전트
- 대화 처리, 컨텍스트 구성, LLM 호출

### 5.2 LLMClient (`lib/ai-agent/llm-client.ts`)
- OpenAI/Claude API 클라이언트
- 동적 모델 선택 (ModelSelector)

### 5.3 MemoryManager (`lib/ai-agent/memory-system.ts`)
- 기억 저장/조회
- 대화에서 기억 자동 추출

### 5.4 ScenarioService (`lib/ai-agent/scenario-service.ts`)
- 시나리오 조회/진행/완료
- 시나리오 완료 시 상태 업데이트

### 5.5 EventTriggerService (`lib/ai-agent/event-trigger-service.ts`)
- DB 기반 이벤트 트리거
- 리텐션 분석

### 5.6 PersonaLoader (`lib/ai-agent/persona-loader.ts`)
- Origin Persona 데이터 로드
- 캐싱

---

## 6. 마이그레이션 파일

| 파일 | 설명 |
|------|------|
| `012_persona_memory_system.sql` | 기억/시나리오 테이블 |
| `013_enhance_personas_table.sql` | 페르소나 테이블 확장 |
| `014_event_trigger_system.sql` | 이벤트 트리거 테이블 |
| `015_user_instance_enhancement.sql` | User Instance 테이블 보강 |
| `016_db_functions.sql` | DB 함수 (RPC) |

---

## 7. 기획 의도

### 7.1 단일 플레이어 경험
- 유저 A와 유저 B의 데이터는 완전히 분리
- 각 유저는 독립적인 페르소나 인스턴스를 가짐

### 7.2 살아있는 페르소나
- 페르소나가 먼저 연락 (Event Trigger)
- SNS 피드 업데이트
- 유저 비활성 시 리텐션 메시지

### 7.3 DM + 시나리오 하이브리드
- DM: 일상적인 대화, 관계 빌드업
- 시나리오: 중요한 순간의 몰입감 있는 연출
- 자연스러운 전환

### 7.4 기억과 성장
- 중요한 순간 자동 기억
- 기억을 기반으로 한 대화
- 관계 단계별 행동 변화
