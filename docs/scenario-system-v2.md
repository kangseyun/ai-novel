# 시나리오 시스템 V2 개발 계획

## 1. 개요

### 1.1 목표
- 콘텐츠 제작 효율성 향상 (AI 자동 생성)
- 유저 개인화 경험 강화 (Dynamic 시나리오)
- Event Trigger 시스템과 유기적 연동

### 1.2 시나리오 분류

| 타입 | 설명 | 제작비용 | 개인화 | 품질통제 |
|------|------|---------|--------|---------|
| **Static** | 모든 씬/대사가 사전 정의됨 | 높음 | 낮음 | 완벽 |
| **Guided** | 플롯 구조 정의 + AI가 대사 생성 | 중간 | 중간 | 양호 |
| **Dynamic** | 트리거 조건만 정의, AI가 전체 생성 | 낮음 | 높음 | 모니터링 필요 |

---

## 2. 데이터베이스 스키마

### 2.1 Event Trigger 시스템

```sql
-- 이벤트 트리거 정의
CREATE TABLE event_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- 트리거 조건 타입
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'relationship_milestone',  -- 관계 단계 변화 시
    'affection_threshold',     -- 호감도 임계값 도달 시
    'time_based',              -- 특정 시간/요일
    'message_count',           -- 메시지 N개 이후
    'keyword_detected',        -- 특정 키워드 감지
    'random_chance',           -- 확률 기반
    'date_event',              -- 특별 날짜 (생일, 기념일)
    'inactivity',              -- 유저 비활성 기간
    'first_interaction',       -- 첫 상호작용
    'custom'                   -- 커스텀 조건
  )),

  -- 트리거 조건 상세
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    relationship_milestone: { "stage": "crush", "direction": "upgrade" }
    affection_threshold: { "min": 50, "max": 100 }
    time_based: { "hour": 22, "day_of_week": [5, 6] }
    message_count: { "count": 10, "since": "session_start" }
    keyword_detected: { "keywords": ["보고싶", "좋아"], "match_type": "any" }
    random_chance: { "probability": 0.1, "cooldown_hours": 24 }
    date_event: { "type": "birthday" | "anniversary" | "holiday", "days_before": 0 }
    inactivity: { "hours": 48 }
  */

  -- 트리거 결과 액션
  action_type TEXT NOT NULL CHECK (action_type IN (
    'start_scenario',          -- 시나리오 시작
    'send_message',            -- 메시지 전송
    'unlock_content',          -- 콘텐츠 해금
    'grant_reward',            -- 보상 지급
    'update_relationship'      -- 관계 상태 업데이트
  )),

  -- 액션 상세
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    start_scenario: {
      "scenario_type": "static" | "guided" | "dynamic",
      "scenario_id": "xxx" (static/guided),
      "dynamic_template_id": "xxx" (dynamic)
    }
  */

  -- 연결된 페르소나 (null이면 전역)
  persona_id TEXT REFERENCES persona_core(id),

  -- 우선순위 (높을수록 먼저 평가)
  priority INTEGER DEFAULT 0,

  -- 쿨다운 (같은 트리거 재발동 방지)
  cooldown_hours INTEGER DEFAULT 0,

  -- 1회성 여부
  is_one_time BOOLEAN DEFAULT false,

  -- 활성화 상태
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 유저별 트리거 발동 기록
CREATE TABLE user_trigger_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  trigger_id UUID NOT NULL REFERENCES event_triggers(id),
  persona_id TEXT,

  triggered_at TIMESTAMPTZ DEFAULT NOW(),

  -- 발동 시점의 컨텍스트
  context JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "affection": 55,
      "relationship_stage": "interest",
      "message_content": "오늘 뭐해?",
      "session_message_count": 15
    }
  */

  -- 결과
  action_result JSONB DEFAULT '{}'::jsonb,

  UNIQUE(user_id, trigger_id) -- 1회성 트리거용
);

-- 인덱스
CREATE INDEX idx_event_triggers_persona ON event_triggers(persona_id);
CREATE INDEX idx_event_triggers_type ON event_triggers(trigger_type);
CREATE INDEX idx_user_trigger_history_user ON user_trigger_history(user_id);
```

### 2.2 Guided 시나리오 템플릿

```sql
-- 기존 scenario_templates 확장
ALTER TABLE scenario_templates ADD COLUMN IF NOT EXISTS
  generation_mode TEXT DEFAULT 'static' CHECK (generation_mode IN (
    'static',    -- 기존 방식 (모든 씬 사전 정의)
    'guided',    -- 플롯 포인트 + AI 생성
    'dynamic'    -- 완전 동적 생성
  ));

-- Guided 시나리오 플롯 구조
CREATE TABLE guided_scenario_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id TEXT NOT NULL REFERENCES scenario_templates(id) ON DELETE CASCADE,

  -- 플롯 포인트 (순서대로)
  plot_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  /*
    [
      {
        "id": "intro",
        "type": "exposition",
        "goal": "캐릭터가 우연히 마주치는 상황 설정",
        "required_elements": ["장소 묘사", "캐릭터 등장"],
        "mood": "mysterious",
        "min_exchanges": 2,
        "max_exchanges": 4
      },
      {
        "id": "rising_action",
        "type": "conflict",
        "goal": "긴장감 형성, 캐릭터의 의외의 면 발견",
        "choice_point": true,
        "choices": [
          { "id": "curious", "direction": "호기심 표현", "affection": 5 },
          { "id": "cautious", "direction": "경계심 표현", "affection": -2 }
        ]
      },
      {
        "id": "climax",
        "type": "turning_point",
        "goal": "관계의 전환점, 감정적 교류",
        "premium_option": {
          "id": "intimate",
          "direction": "더 깊은 대화 시도",
          "affection": 15
        }
      },
      {
        "id": "resolution",
        "type": "resolution",
        "goal": "다음 만남에 대한 기대감 형성",
        "ending_hook": true
      }
    ]
  */

  -- AI 생성 규칙
  generation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    {
      "tone": "romantic_tension",
      "pacing": "slow_burn",
      "dialogue_style": "natural_korean",
      "forbidden_topics": ["과도한 신체 접촉", "폭력"],
      "required_callbacks": ["이전 대화 참조", "캐릭터 특성 반영"],
      "max_message_length": 200,
      "include_inner_thoughts": true
    }
  */

  -- 캐릭터 행동 가이드라인
  character_guidelines JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "emotional_range": ["shy", "teasing", "curious"],
      "speech_patterns_override": null,  -- null이면 페르소나 기본값 사용
      "relationship_stage_behavior": "interest"  -- 이 시나리오에서의 행동 단계
    }
  */

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dynamic 시나리오 템플릿
CREATE TABLE dynamic_scenario_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL REFERENCES persona_core(id),

  name TEXT NOT NULL,
  description TEXT,

  -- 발동 트리거 연결
  trigger_id UUID REFERENCES event_triggers(id),

  -- 시나리오 유형
  scenario_category TEXT NOT NULL CHECK (scenario_category IN (
    'daily_event',      -- 일상 이벤트 (식사, 취미 등)
    'emotional_moment', -- 감정적 순간 (위로, 축하 등)
    'special_date',     -- 특별한 날 (생일, 기념일)
    'conflict',         -- 갈등 상황
    'intimacy',         -- 친밀감 증가 순간
    'surprise',         -- 깜짝 이벤트
    'callback'          -- 과거 대화 참조 이벤트
  )),

  -- AI 생성 프롬프트 템플릿
  system_prompt_template TEXT NOT NULL,
  /*
    "당신은 {persona_name}입니다.
     현재 {user_name}과의 관계는 {relationship_stage} 단계입니다.
     호감도는 {affection_level}입니다.

     다음 상황에서 자연스러운 대화를 이어가세요:
     - 상황: {scenario_context}
     - 목표: {scenario_goal}
     - 이전 대화 요약: {conversation_summary}

     규칙:
     - {character_guidelines}
     - 메시지는 2-3문장으로 간결하게
     - 자연스러운 한국어 구어체 사용"
  */

  -- 컨텍스트 변수 (시스템이 자동 주입)
  context_variables TEXT[] DEFAULT ARRAY[
    'persona_name', 'user_name', 'relationship_stage',
    'affection_level', 'conversation_summary', 'time_of_day'
  ],

  -- 시나리오 목표
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  /*
    [
      "유저와 자연스러운 대화 3회 이상",
      "감정적 교류 1회 이상",
      "다음 대화 약속 유도"
    ]
  */

  -- 종료 조건
  end_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
    {
      "max_exchanges": 10,
      "goal_achieved": true,
      "user_disengaged": { "no_response_count": 2 },
      "natural_ending_detected": true
    }
  */

  -- 품질 게이트
  quality_gates JSONB DEFAULT '{}'::jsonb,
  /*
    {
      "blocked_topics": ["정치", "종교", "성적 콘텐츠"],
      "min_character_consistency": 0.8,
      "fallback_responses": [
        "흠... 잠깐 딴 생각했어. 뭐라고 했어?",
        "아, 미안. 다시 한번 말해줄래?"
      ]
    }
  */

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. AI 시나리오 자동 생성 기능

### 3.1 어드민 워크플로우

```
[페르소나 선택] → [시나리오 유형 선택] → [개요 입력]
      ↓
[AI 초벌 생성] → [검토/수정] → [미리보기] → [발행]
```

### 3.2 생성 파라미터

```typescript
interface ScenarioGenerationRequest {
  personaId: string;
  generationMode: 'static' | 'guided' | 'dynamic';

  // 공통
  title: string;
  description: string;
  targetRelationshipStage: string;
  estimatedDuration: number; // 분 단위

  // Static 생성용
  staticConfig?: {
    plotOutline: string;        // "첫 만남 → 오해 → 화해 → 연락처 교환"
    sceneCount: number;         // 원하는 씬 개수
    choicePoints: number;       // 선택지 씬 개수
    includesPremiumChoice: boolean;
    mood: string[];             // ["romantic", "humorous"]
  };

  // Guided 생성용
  guidedConfig?: {
    plotPoints: PlotPoint[];
    generationRules: GenerationRules;
  };

  // Dynamic 생성용
  dynamicConfig?: {
    scenarioCategory: string;
    triggerConditions: TriggerCondition[];
    systemPromptTemplate: string;
  };
}
```

### 3.3 생성 프롬프트 예시 (Static)

```
당신은 인터랙티브 스토리 작가입니다.

# 캐릭터 정보
- 이름: {persona.name}
- 성격: {persona.personality}
- 말투: {persona.speechPatterns}
- 현재 관계 단계에서의 행동: {persona.behaviorByStage[targetStage]}

# 시나리오 요구사항
- 제목: {title}
- 설명: {description}
- 타겟 관계 단계: {targetRelationshipStage}
- 플롯 개요: {plotOutline}
- 예상 씬 개수: {sceneCount}
- 선택지 씬 개수: {choicePoints}
- 프리미엄 선택지 포함: {includesPremiumChoice}
- 분위기: {mood}

# 출력 형식
다음 JSON 형식으로 시나리오를 생성하세요:

{
  "scenes": [
    {
      "id": "scene_1",
      "type": "narration" | "dialogue" | "choice",
      "text": "씬 텍스트",
      "character": "캐릭터명 (dialogue일 경우)",
      "expression": "표정 (happy, sad, shy, teasing...)",
      "innerThought": "내면 독백 (선택적)",
      "choices": [  // choice 타입일 경우
        {
          "id": "choice_1",
          "text": "선택지 텍스트",
          "tone": "friendly",
          "nextScene": "scene_2",
          "affectionChange": 5,
          "isPremium": false
        }
      ]
    }
  ]
}

# 주의사항
1. 캐릭터의 말투와 성격을 일관되게 유지
2. 선택지는 명확히 다른 결과를 암시
3. 프리미엄 선택지는 더 친밀하거나 특별한 상호작용
4. 자연스러운 한국어 사용
5. 씬 간 자연스러운 전환
```

---

## 4. 구현 우선순위

### Phase 1: 기반 구축 (1주) ✅ 완료
1. [x] Event Trigger 테이블 마이그레이션 → `054_scenario_system_v2.sql`
2. [x] Guided/Dynamic 템플릿 테이블 마이그레이션 → `054_scenario_system_v2.sql`
3. [x] scenario_templates에 generation_mode 필드 추가 → `054_scenario_system_v2.sql`

### Phase 2: Trigger 시스템 (1주) ✅ 완료
4. [x] TriggerService 구현 (조건 평가, 발동 기록) → `lib/ai-agent/modules/event-trigger-service.ts`
5. [x] DM Chat에 트리거 평가 로직 통합 → `lib/ai-agent/core/ai-agent.ts` (processUserMessage)
6. [x] 어드민 트리거 관리 UI → `app/admin/triggers/page.tsx`

### Phase 3: AI 생성기 (1주) ✅ 완료
7. [x] ScenarioGeneratorService 구현 → `lib/ai-agent/modules/scenario-generator-service.ts`
8. [x] 어드민 시나리오 생성 UI (Static 초벌 생성) → `app/admin/scenarios/generate/page.tsx`
9. [x] 생성/저장 API → `app/api/admin/scenarios/generate/route.ts`, `app/api/admin/scenarios/save/route.ts`

### Phase 4: Guided 시나리오 (1주) ✅ 완료
10. [x] GuidedScenarioEngine 구현 → `lib/ai-agent/modules/guided-scenario-engine.ts`
11. [x] 플롯 포인트 기반 대화 생성 → `GuidedScenarioEngine.generateNextExchange()`
12. [x] AI Agent 통합 → `lib/ai-agent/core/ai-agent.ts` (startScenario, processScenarioMessage)

### Phase 5: Dynamic 시나리오 (1주) ✅ 완료
13. [x] DynamicScenarioEngine 구현 → `lib/ai-agent/modules/dynamic-scenario-engine.ts`
14. [x] 실시간 시나리오 생성 및 품질 모니터링 → 가드레일 체크, 폴백 응답
15. [x] 통합 세션 매니저 → `lib/ai-agent/modules/scenario-session-manager.ts`
16. [x] Guided/Dynamic 세션 테이블 마이그레이션 → `055_guided_dynamic_sessions.sql`

---

## 5. 서비스 아키텍처

```typescript
// lib/ai-agent/modules/trigger-service.ts
class TriggerService {
  evaluateTriggers(context: TriggerContext): Promise<TriggeredEvent[]>
  recordTriggerFired(userId: string, triggerId: string, context: object): Promise<void>
  checkCooldown(userId: string, triggerId: string): Promise<boolean>
}

// lib/ai-agent/modules/scenario-generator.ts
class ScenarioGeneratorService {
  generateStaticScenario(request: ScenarioGenerationRequest): Promise<GeneratedScenario>
  generateGuidedTemplate(request: GuidedTemplateRequest): Promise<GuidedScenarioPlot>
  refineDraft(draft: GeneratedScenario, feedback: string): Promise<GeneratedScenario>
}

// lib/ai-agent/modules/guided-scenario-engine.ts
class GuidedScenarioEngine {
  initializeSession(templateId: string, userId: string): Promise<GuidedSession>
  generateNextExchange(session: GuidedSession, userInput: string): Promise<ScenarioMessage>
  evaluatePlotProgress(session: GuidedSession): PlotProgress
}

// lib/ai-agent/modules/dynamic-scenario-engine.ts
class DynamicScenarioEngine {
  startDynamicScenario(templateId: string, context: DynamicContext): Promise<DynamicSession>
  continueConversation(session: DynamicSession, userMessage: string): Promise<AIResponse>
  checkEndConditions(session: DynamicSession): EndConditionResult
  applyQualityGates(response: AIResponse): QualityCheckResult
}
```

---

## 6. 어드민 UI 구조

### 6.1 시나리오 관리 페이지 확장

```
/admin/scenarios
├── /new                    # 새 시나리오 (Static)
├── /[id]                   # 시나리오 편집 (기존)
├── /generate               # AI 시나리오 생성 (NEW)
│   ├── ?mode=static        # Static 초벌 생성
│   ├── ?mode=guided        # Guided 템플릿 생성
│   └── ?mode=dynamic       # Dynamic 템플릿 생성
└── /templates              # Guided/Dynamic 템플릿 목록 (NEW)

/admin/triggers             # 이벤트 트리거 관리 (NEW)
├── /                       # 트리거 목록
├── /new                    # 새 트리거 생성
└── /[id]                   # 트리거 편집
```

### 6.2 AI 생성 UI 컴포넌트

```tsx
// 시나리오 생성 페이지
<ScenarioGeneratorPage>
  <Step1_SelectMode />        {/* static | guided | dynamic */}
  <Step2_SelectPersona />      {/* 페르소나 선택 */}
  <Step3_ConfigureScenario />  {/* 제목, 설명, 파라미터 */}
  <Step4_GeneratePreview />    {/* AI 생성 + 미리보기 */}
  <Step5_EditAndRefine />      {/* 수동 수정 */}
  <Step6_Publish />            {/* 발행 */}
</ScenarioGeneratorPage>
```

---

## 7. 품질 보장

### 7.1 Static 시나리오
- AI 생성 후 반드시 수동 검토
- 유효성 검사 (씬 연결, 도달 가능성)
- 테스트 플레이 기능

### 7.2 Guided 시나리오
- 플롯 포인트별 예시 대화 테스트
- 캐릭터 일관성 검증
- A/B 테스트로 최적 설정 도출

### 7.3 Dynamic 시나리오
- 실시간 품질 모니터링 대시보드
- 금지어/주제 필터링
- Fallback 응답 시스템
- 유저 피드백 수집

---

## 8. 향후 확장

- [ ] 멀티 캐릭터 시나리오 지원
- [ ] 유저 선택 히스토리 기반 개인화
- [ ] 시나리오 분기 시각화 고도화
- [ ] 음성 메시지 시나리오 지원
- [ ] 이미지/스티커 시나리오 요소
