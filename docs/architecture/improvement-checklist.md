# AI Novel 시스템 개선 체크리스트

> 작성일: 2025-12-03
> 현재 구현율: ~95%
> 총 개선 항목: 22개
> 예상 총 작업 시간: ~49시간

---

## 목차

1. [Critical Issues (5개)](#1-critical-issues)
2. [High Priority Issues (5개)](#2-high-priority-issues)
3. [Medium Priority Issues (6개)](#3-medium-priority-issues)
4. [Low Priority Issues (6개)](#4-low-priority-issues)
5. [Database Migration 추가 사항](#5-database-migration-추가-사항)
6. [진행 상황 트래킹](#6-진행-상황-트래킹)

---

## 1. Critical Issues

### 1.1 delivery_conditions 미구현

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/ai-agent.ts:332`
- **예상 시간**: 4시간
- **위험도**: High

#### 문제점

이벤트 전달 조건(`delivery_conditions`)이 DB 스키마에 존재하지만 실제로 검증되지 않음.
유저가 오프라인이거나, 특정 시간대가 아니어도 이벤트가 전달됨.

#### 현재 코드

```typescript
// lib/ai-agent/ai-agent.ts:331-332
// 전달 조건 재확인
// TODO: delivery_conditions 체크
```

#### 수정 방법

```typescript
// lib/ai-agent/ai-agent.ts - processScheduledEvent 메서드 내부

async processScheduledEvent(eventId: string): Promise<{ delivered: boolean; message?: string }> {
  // 기존 이벤트 조회 코드...

  // delivery_conditions 검증 추가
  if (event.delivery_conditions && Object.keys(event.delivery_conditions).length > 0) {
    const canDeliver = await this.validateDeliveryConditions(
      event.delivery_conditions,
      event.user_id,
      event.persona_id
    );

    if (!canDeliver) {
      // 조건 미충족 시 만료 처리 또는 재스케줄
      await this.supabase
        .from('scheduled_events')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      return { delivered: false, message: 'Delivery conditions not met' };
    }
  }

  // 기존 전달 로직 계속...
}

// 새 메서드 추가
private async validateDeliveryConditions(
  conditions: Record<string, unknown>,
  userId: string,
  personaId: string
): Promise<boolean> {
  // 1. 현재 유저-페르소나 관계 조회
  const { data: relationship } = await this.supabase
    .from('user_persona_relationships')
    .select('affection, relationship_stage')
    .eq('user_id', userId)
    .eq('persona_id', personaId)
    .single();

  if (!relationship) return false;

  // 2. 호감도 조건 체크
  if (conditions.minAffection !== undefined) {
    if (relationship.affection < (conditions.minAffection as number)) {
      return false;
    }
  }

  if (conditions.maxAffection !== undefined) {
    if (relationship.affection > (conditions.maxAffection as number)) {
      return false;
    }
  }

  // 3. 관계 단계 조건 체크
  if (conditions.relationshipStage) {
    const allowedStages = conditions.relationshipStage as string[];
    if (!allowedStages.includes(relationship.relationship_stage)) {
      return false;
    }
  }

  // 4. 시간대 조건 체크
  if (conditions.timeRange) {
    const { start, end } = conditions.timeRange as { start: string; end: string };
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    // 시간 범위 체크 (자정을 넘어가는 경우 고려)
    if (start <= end) {
      if (currentTime < start || currentTime > end) return false;
    } else {
      // 예: 22:00 ~ 02:00
      if (currentTime < start && currentTime > end) return false;
    }
  }

  // 5. 필수 플래그 체크
  if (conditions.requiredFlags) {
    const requiredFlags = conditions.requiredFlags as string[];
    const { data: rel } = await this.supabase
      .from('user_persona_relationships')
      .select('story_flags')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    const userFlags = rel?.story_flags || {};
    for (const flag of requiredFlags) {
      if (!userFlags[flag]) return false;
    }
  }

  // 6. 제외 플래그 체크
  if (conditions.excludeFlags) {
    const excludeFlags = conditions.excludeFlags as string[];
    const { data: rel } = await this.supabase
      .from('user_persona_relationships')
      .select('story_flags')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .single();

    const userFlags = rel?.story_flags || {};
    for (const flag of excludeFlags) {
      if (userFlags[flag]) return false;
    }
  }

  return true;
}
```

#### 테스트 방법

```typescript
// 테스트 케이스
// 1. minAffection: 30인데 유저 호감도 20 → 전달 안 됨
// 2. timeRange: 22:00-02:00인데 현재 15:00 → 전달 안 됨
// 3. requiredFlags: ['had_first_conflict']인데 플래그 없음 → 전달 안 됨
// 4. 모든 조건 충족 → 전달됨
```

---

### 1.2 토큰 차감 Race Condition

- **상태**: [ ] 미완료
- **파일**: `app/api/ai/chat/route.ts:37-70`
- **예상 시간**: 2시간
- **위험도**: Critical (보안/수익)

#### 문제점

토큰 잔액 확인과 차감이 별도 쿼리로 실행됨. 동시에 여러 요청을 보내면 잔액 검증을 모두 통과한 후 차감되어 무료로 메시지 전송 가능.

#### 현재 코드

```typescript
// app/api/ai/chat/route.ts:37-70

// 1. 잔액 확인 (시점 A)
if (currentTokens < TOKEN_COST_PER_MESSAGE) {
  return NextResponse.json({ error: 'insufficient_tokens' }, { status: 402 });
}

// ... 메시지 처리 (시간 소요)

// 2. 차감 (시점 B) - 시점 A와 B 사이에 다른 요청이 끼어들 수 있음
await supabase
  .from('users')
  .update({ tokens: newTokenBalance })
  .eq('id', user.id);
```

#### 수정 방법

**Step 1: DB 함수 생성 (마이그레이션 추가)**

```sql
-- supabase/migrations/017_atomic_token_functions.sql

-- 원자적 토큰 차감 함수
CREATE OR REPLACE FUNCTION deduct_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_min_balance INTEGER DEFAULT 0
)
RETURNS TABLE(success BOOLEAN, previous_balance INTEGER, new_balance INTEGER) AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  -- FOR UPDATE로 행 잠금
  SELECT tokens INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- 잔액 부족 체크
  IF v_current_balance IS NULL OR v_current_balance < p_amount OR v_current_balance - p_amount < p_min_balance THEN
    RETURN QUERY SELECT FALSE, COALESCE(v_current_balance, 0), COALESCE(v_current_balance, 0);
    RETURN;
  END IF;

  -- 원자적 차감
  UPDATE users
  SET tokens = tokens - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_current_balance, v_current_balance - p_amount;
END;
$$ LANGUAGE plpgsql;

-- 토큰 추가 함수 (보상/구매용)
CREATE OR REPLACE FUNCTION add_tokens(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS TABLE(success BOOLEAN, previous_balance INTEGER, new_balance INTEGER) AS $$
DECLARE
  v_current_balance INTEGER;
BEGIN
  SELECT tokens INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0;
    RETURN;
  END IF;

  UPDATE users
  SET tokens = tokens + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_current_balance, v_current_balance + p_amount;
END;
$$ LANGUAGE plpgsql;
```

**Step 2: API 라우트 수정**

```typescript
// app/api/ai/chat/route.ts

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { personaId, message, sessionId, choiceData } = await request.json();

    // 원자적 토큰 차감
    const { data: tokenResult, error: tokenError } = await supabase.rpc('deduct_tokens', {
      p_user_id: user.id,
      p_amount: TOKEN_COST_PER_MESSAGE,
      p_min_balance: 0
    });

    if (tokenError || !tokenResult?.[0]?.success) {
      return NextResponse.json(
        {
          error: 'insufficient_tokens',
          currentBalance: tokenResult?.[0]?.previous_balance || 0,
          required: TOKEN_COST_PER_MESSAGE
        },
        { status: 402 }
      );
    }

    const newTokenBalance = tokenResult[0].new_balance;

    // 메시지 처리...
    // (토큰은 이미 차감됨 - 실패 시 환불 로직 필요)

    try {
      const response = await agent.processMessage(sessionId, message, choiceData);

      return NextResponse.json({
        ...response,
        tokenBalance: newTokenBalance,
      });
    } catch (processError) {
      // 메시지 처리 실패 시 토큰 환불
      await supabase.rpc('add_tokens', {
        p_user_id: user.id,
        p_amount: TOKEN_COST_PER_MESSAGE
      });

      throw processError;
    }
  } catch (error) {
    // ...
  }
}
```

#### 테스트 방법

```bash
# 동시 요청 테스트 (토큰 1개 남은 상태에서)
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/ai/chat \
    -H "Content-Type: application/json" \
    -d '{"personaId":"jun","message":"test"}' &
done
wait

# 결과: 1개만 성공, 나머지 9개는 402 에러
```

---

### 1.3 비동기 메모리 추출 에러 무시

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/ai-agent.ts:213-222`
- **예상 시간**: 3시간
- **위험도**: High (데이터 손실)

#### 문제점

메모리 추출이 fire-and-forget 패턴으로 실행되어 에러 발생 시 `console.error`만 출력. 중요한 기억이 저장되지 않아도 알 수 없음.

#### 현재 코드

```typescript
// lib/ai-agent/ai-agent.ts:213-222

// 기억 추출 (비동기, 에러 무시)
this.memoryManager.extractMemoriesFromConversation(
  session.userId,
  session.personaId,
  [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: llmResponse.message },
  ]
).catch(err => console.error('[AIAgent] Memory extraction error:', err));
```

#### 수정 방법

**Step 1: 메모리 추출 큐 시스템 구현**

```typescript
// lib/ai-agent/ai-agent.ts

// 클래스 상단에 추가
private memoryExtractionQueue: Array<{
  userId: string;
  personaId: string;
  messages: Array<{ role: string; content: string }>;
  retryCount: number;
  sessionId: string;
}> = [];
private isProcessingMemoryQueue = false;
private readonly MAX_RETRY_COUNT = 3;
private readonly RETRY_DELAY_MS = 5000;

// 새 메서드들 추가
private async queueMemoryExtraction(
  userId: string,
  personaId: string,
  messages: Array<{ role: string; content: string }>,
  sessionId: string
): Promise<void> {
  this.memoryExtractionQueue.push({
    userId,
    personaId,
    messages,
    retryCount: 0,
    sessionId,
  });

  if (!this.isProcessingMemoryQueue) {
    this.processMemoryQueue();
  }
}

private async processMemoryQueue(): Promise<void> {
  if (this.isProcessingMemoryQueue || this.memoryExtractionQueue.length === 0) {
    return;
  }

  this.isProcessingMemoryQueue = true;

  while (this.memoryExtractionQueue.length > 0) {
    const item = this.memoryExtractionQueue.shift()!;

    try {
      await this.memoryManager.extractMemoriesFromConversation(
        item.userId,
        item.personaId,
        item.messages
      );

      console.log(`[AIAgent] Memory extraction successful for session ${item.sessionId}`);
    } catch (error) {
      console.error(`[AIAgent] Memory extraction error (attempt ${item.retryCount + 1}):`, error);

      if (item.retryCount < this.MAX_RETRY_COUNT) {
        // 재시도 큐에 추가 (지연 후)
        setTimeout(() => {
          this.memoryExtractionQueue.push({
            ...item,
            retryCount: item.retryCount + 1,
          });
          this.processMemoryQueue();
        }, this.RETRY_DELAY_MS * (item.retryCount + 1)); // 점진적 지연
      } else {
        // 최대 재시도 초과 - 에러 로깅 테이블에 저장
        await this.logCriticalError('memory_extraction_failed', error as Error, {
          userId: item.userId,
          personaId: item.personaId,
          sessionId: item.sessionId,
          messages: item.messages,
          retryCount: item.retryCount,
        });
      }
    }
  }

  this.isProcessingMemoryQueue = false;
}

private async logCriticalError(
  errorType: string,
  error: Error,
  context: Record<string, unknown>
): Promise<void> {
  try {
    await this.supabase.from('error_logs').insert({
      error_type: errorType,
      error_message: error.message,
      error_stack: error.stack,
      context,
      created_at: new Date().toISOString(),
    });
  } catch (logError) {
    // 에러 로깅 실패 시 콘솔에만 출력
    console.error('[AIAgent] Failed to log critical error:', logError);
    console.error('[AIAgent] Original error:', { errorType, error, context });
  }
}
```

**Step 2: 에러 로그 테이블 마이그레이션**

```sql
-- supabase/migrations/017_error_logs.sql

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON error_logs(resolved) WHERE resolved = false;
```

**Step 3: processMessage에서 호출 변경**

```typescript
// lib/ai-agent/ai-agent.ts - processMessage 메서드 내

// 기존 코드 대체
// this.memoryManager.extractMemoriesFromConversation(...)
//   .catch(err => console.error('[AIAgent] Memory extraction error:', err));

// 새 코드
this.queueMemoryExtraction(
  session.userId,
  session.personaId,
  [
    { role: 'user', content: userMessage },
    { role: 'assistant', content: llmResponse.message },
  ],
  sessionId
);
```

---

### 1.4 이벤트 중복 스케줄링

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/event-trigger-service.ts:276-301`
- **예상 시간**: 2시간
- **위험도**: Medium (UX)

#### 문제점

동일한 유저/페르소나에 대해 같은 타입의 이벤트가 여러 번 스케줄될 수 있음. 유저가 중복 알림을 받게 됨.

#### 현재 코드

```typescript
// lib/ai-agent/event-trigger-service.ts:276-301

async scheduleEvent(event: Partial<ScheduledEvent>): Promise<DBScheduledEvent | null> {
  // 중복 체크 없이 바로 insert
  const { data, error } = await this.supabase
    .from('scheduled_events')
    .insert({
      user_id: event.userId,
      persona_id: event.personaId,
      // ...
    })
    .select()
    .single();
  // ...
}
```

#### 수정 방법

```typescript
// lib/ai-agent/event-trigger-service.ts

async scheduleEvent(event: Partial<ScheduledEvent>): Promise<DBScheduledEvent | null> {
  // 1. 최근 1시간 내 동일 타입 이벤트 체크
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const { data: recentEvents } = await this.supabase
    .from('scheduled_events')
    .select('id, created_at, status')
    .eq('user_id', event.userId)
    .eq('persona_id', event.personaId)
    .eq('event_type', event.eventType)
    .in('status', ['pending', 'delivered'])
    .gt('created_at', oneHourAgo)
    .limit(1);

  if (recentEvents && recentEvents.length > 0) {
    console.log(`[EventTriggerService] Duplicate event prevented: ${event.eventType} for user ${event.userId}`);
    return null;
  }

  // 2. 동일 유저에게 오늘 전송된 이벤트 수 체크 (일일 한도)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count: todayCount } = await this.supabase
    .from('scheduled_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', event.userId)
    .eq('persona_id', event.personaId)
    .eq('status', 'delivered')
    .gte('delivered_at', todayStart.toISOString());

  const MAX_DAILY_EVENTS = 5;
  if ((todayCount || 0) >= MAX_DAILY_EVENTS) {
    console.log(`[EventTriggerService] Daily limit reached for user ${event.userId}`);
    return null;
  }

  // 3. 이벤트 스케줄링
  const { data, error } = await this.supabase
    .from('scheduled_events')
    .insert({
      user_id: event.userId,
      persona_id: event.personaId,
      trigger_rule_id: event.triggerRuleId,
      event_type: event.eventType,
      event_data: event.eventData,
      scheduled_for: event.scheduledFor,
      delivery_conditions: event.deliveryConditions,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[EventTriggerService] Failed to schedule event:', error);
    return null;
  }

  return data;
}
```

---

### 1.5 세션 검증 부족

- **상태**: [ ] 미완료
- **파일**: `app/api/ai/chat/route.ts:49-51`
- **예상 시간**: 1시간
- **위험도**: High (데이터 무결성)

#### 문제점

세션 ID가 전달되면 해당 세션이 다른 페르소나의 것인지 검증하지 않음. 잘못된 세션으로 메시지가 저장될 수 있음.

#### 현재 코드

```typescript
// app/api/ai/chat/route.ts:49-51

const session = sessionId
  ? await agent.getSession(sessionId) ?? await agent.getOrCreateSession(user.id, personaId)
  : await agent.getOrCreateSession(user.id, personaId);
```

#### 수정 방법

```typescript
// app/api/ai/chat/route.ts

// 입력 검증
if (!personaId || typeof personaId !== 'string') {
  return NextResponse.json({ error: 'Invalid personaId' }, { status: 400 });
}

if (!message || typeof message !== 'string' || message.trim().length === 0) {
  return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
}

// 세션 처리 (개선된 버전)
let session: ConversationSession | null = null;

if (sessionId) {
  // 1. 세션 존재 여부 확인
  session = await agent.getSession(sessionId);

  if (session) {
    // 2. 세션이 현재 유저 소유인지 확인
    if (session.userId !== user.id) {
      return NextResponse.json(
        { error: 'Session does not belong to current user' },
        { status: 403 }
      );
    }

    // 3. 세션이 요청된 페르소나와 일치하는지 확인
    if (session.personaId !== personaId) {
      return NextResponse.json(
        { error: 'Session belongs to different persona' },
        { status: 400 }
      );
    }
  }
  // 세션이 없으면 null 유지 (아래에서 새로 생성)
}

// 세션이 없으면 새로 생성
if (!session) {
  session = await agent.getOrCreateSession(user.id, personaId);
}

// 세션 생성 실패 체크
if (!session) {
  return NextResponse.json(
    { error: 'Failed to create conversation session' },
    { status: 500 }
  );
}
```

---

## 2. High Priority Issues

### 2.1 메모리 만료 시스템 미구현

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/memory-service.ts` (새 메서드 추가)
- **예상 시간**: 5시간
- **위험도**: Medium (시스템 건강성)

#### 문제점

`persona_memories` 테이블에 `expires_at`, `is_active` 필드가 있지만 만료 로직이 구현되지 않음. 오래된 저품질 기억이 무한히 축적됨.

#### 수정 방법

```typescript
// lib/ai-agent/memory-service.ts

// ============================================
// 메모리 관리 (만료/통합)
// ============================================

/**
 * 오래된 저품질 기억 만료 처리
 * - 90일 이상 된 기억 중 참조 횟수 2회 미만
 * - importance_score 3 이하
 */
async expireOldMemories(userId: string, personaId: string): Promise<number> {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // importance_score가 낮고 오래된 기억 만료
  const { data: expiredLowImportance } = await this.supabase
    .from('persona_memories')
    .update({
      is_active: false,
      expires_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('persona_id', personaId)
    .eq('is_active', true)
    .lt('created_at', cutoffDate)
    .lte('importance_score', 3)
    .select('id');

  // 90일 이상 되고 참조가 거의 없는 기억 만료
  const { data: expiredOld } = await this.supabase
    .from('persona_memories')
    .update({
      is_active: false,
      expires_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('persona_id', personaId)
    .eq('is_active', true)
    .lt('created_at', cutoffDate)
    .lte('importance_score', 5)
    .select('id');

  const expiredCount = (expiredLowImportance?.length || 0) + (expiredOld?.length || 0);

  if (expiredCount > 0) {
    console.log(`[MemoryService] Expired ${expiredCount} old memories for ${userId}/${personaId}`);
  }

  return expiredCount;
}

/**
 * 유사한 기억 통합 (요약)
 * 같은 타입의 기억이 10개 이상이면 요약본으로 통합
 */
async consolidateMemories(userId: string, personaId: string): Promise<void> {
  // 타입별 기억 수 조회
  const { data: memoryCounts } = await this.supabase
    .from('persona_memories')
    .select('memory_type')
    .eq('user_id', userId)
    .eq('persona_id', personaId)
    .eq('is_active', true);

  if (!memoryCounts) return;

  // 타입별 카운트
  const countByType: Record<string, number> = {};
  for (const m of memoryCounts) {
    countByType[m.memory_type] = (countByType[m.memory_type] || 0) + 1;
  }

  // 10개 이상인 타입 처리
  for (const [memoryType, count] of Object.entries(countByType)) {
    if (count >= 10) {
      await this.consolidateMemoriesByType(userId, personaId, memoryType);
    }
  }
}

private async consolidateMemoriesByType(
  userId: string,
  personaId: string,
  memoryType: string
): Promise<void> {
  // 해당 타입의 가장 오래된 기억들 조회 (최대 5개)
  const { data: oldMemories } = await this.supabase
    .from('persona_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('persona_id', personaId)
    .eq('memory_type', memoryType)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(5);

  if (!oldMemories || oldMemories.length < 5) return;

  // 요약 생성 (LLM 호출 또는 단순 연결)
  const summaries = oldMemories.map(m => m.summary).join('; ');
  const consolidatedSummary = `[통합 기억] ${summaries}`;

  // 새 통합 기억 생성
  await this.supabase.from('persona_memories').insert({
    user_id: userId,
    persona_id: personaId,
    memory_type: memoryType,
    summary: consolidatedSummary,
    details: {
      consolidated: true,
      source_ids: oldMemories.map(m => m.id),
      original_count: oldMemories.length,
    },
    emotional_weight: Math.max(...oldMemories.map(m => m.emotional_weight || 5)),
    importance_score: Math.max(...oldMemories.map(m => m.importance_score || 5)),
    is_active: true,
    source_type: 'system',
  });

  // 원본 기억 비활성화
  await this.supabase
    .from('persona_memories')
    .update({ is_active: false })
    .in('id', oldMemories.map(m => m.id));

  console.log(`[MemoryService] Consolidated ${oldMemories.length} ${memoryType} memories`);
}

/**
 * 메모리 최적화 실행 (일일 배치)
 */
async runMaintenanceJob(userId: string, personaId: string): Promise<{
  expired: number;
  consolidated: boolean;
}> {
  const expired = await this.expireOldMemories(userId, personaId);
  await this.consolidateMemories(userId, personaId);

  return { expired, consolidated: true };
}
```

**배치 작업 API (선택)**

```typescript
// app/api/admin/memory-maintenance/route.ts

export async function POST(request: NextRequest) {
  // Admin 인증 체크...

  const { userId, personaId } = await request.json();

  const memoryService = getMemoryService(supabase);
  const result = await memoryService.runMaintenanceJob(userId, personaId);

  return NextResponse.json(result);
}
```

---

### 2.2 입력 검증 부재

- **상태**: [ ] 미완료
- **파일**: 모든 `/app/api/**` 라우트
- **예상 시간**: 6시간
- **위험도**: Medium (보안)

#### 문제점

API 엔드포인트에 Zod 등의 스키마 검증이 없음. 악의적인 입력으로 인한 보안 취약점 가능성.

#### 수정 방법

**Step 1: Zod 설치**

```bash
yarn add zod
```

**Step 2: 공통 스키마 정의**

```typescript
// lib/validations/api-schemas.ts

import { z } from 'zod';

// 공통 스키마
export const UUIDSchema = z.string().uuid();
export const PersonaIdSchema = z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/);

// Chat API 스키마
export const ChatRequestSchema = z.object({
  personaId: PersonaIdSchema,
  message: z.string().min(1).max(10000).trim(),
  sessionId: UUIDSchema.optional(),
  choiceData: z.object({
    choiceId: z.string(),
    wasPremium: z.boolean(),
  }).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Memory API 스키마
export const MemoryQuerySchema = z.object({
  personaId: PersonaIdSchema,
  limit: z.number().min(1).max(100).optional().default(10),
  memoryType: z.enum([
    'first_meeting', 'promise', 'secret_shared', 'conflict',
    'reconciliation', 'intimate_moment', 'gift_received', 'milestone',
    'user_preference', 'emotional_event', 'location_memory',
    'nickname', 'inside_joke', 'important_date'
  ]).optional(),
});

// Event Check API 스키마
export const EventCheckSchema = z.object({
  personaId: PersonaIdSchema,
  actionType: z.enum([
    'app_open', 'dm_view', 'profile_view',
    'scenario_complete', 'purchase', 'share'
  ]).optional(),
});

// Scenario API 스키마
export const ScenarioStartSchema = z.object({
  personaId: PersonaIdSchema,
  scenarioId: UUIDSchema,
});

export const ScenarioAdvanceSchema = z.object({
  personaId: PersonaIdSchema,
  scenarioId: UUIDSchema,
  nextSceneId: z.string().min(1),
  choiceMade: z.object({
    sceneId: z.string(),
    choiceId: z.string(),
  }).optional(),
});
```

**Step 3: 헬퍼 함수**

```typescript
// lib/validations/validate.ts

import { NextResponse } from 'next/server';
import { z } from 'zod';

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          message: firstError.message,
          path: firstError.path.join('.'),
        },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: result.data };
}
```

**Step 4: API 라우트 적용 예시**

```typescript
// app/api/ai/chat/route.ts

import { ChatRequestSchema } from '@/lib/validations/api-schemas';
import { validateRequest } from '@/lib/validations/validate';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 입력 검증
    const body = await request.json();
    const validation = validateRequest(ChatRequestSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { personaId, message, sessionId, choiceData } = validation.data;

    // 이제 타입 안전한 데이터로 처리...
  } catch (error) {
    // ...
  }
}
```

---

### 2.3 Rate Limiting 미구현

- **상태**: [ ] 미완료
- **파일**: 모든 API 라우트
- **예상 시간**: 4시간
- **위험도**: Medium (보안/비용)

#### 문제점

Rate limiting이 없어 무한 요청 가능. LLM API 비용 폭발 및 서비스 불안정.

#### 수정 방법

**Option A: Upstash Redis 사용 (프로덕션)**

```bash
yarn add @upstash/ratelimit @upstash/redis
```

```typescript
// lib/middleware/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// 엔드포인트별 Rate Limiter
const limiters = {
  // 채팅: 분당 20회
  chat: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    prefix: 'ratelimit:chat',
  }),
  // 이벤트 체크: 분당 60회
  eventCheck: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'ratelimit:event',
  }),
  // 메모리 조회: 분당 30회
  memory: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'ratelimit:memory',
  }),
  // 일반 API: 분당 100회
  default: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'ratelimit:default',
  }),
};

export type RateLimitType = keyof typeof limiters;

export async function checkRateLimit(
  userId: string,
  type: RateLimitType = 'default'
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const limiter = limiters[type];
  const result = await limiter.limit(userId);

  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export function rateLimitResponse(reset: number): NextResponse {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((reset - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    }
  );
}
```

**Option B: 메모리 기반 (개발용)**

```typescript
// lib/middleware/rate-limit-memory.ts

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  userId: string,
  type: string = 'default'
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const limits: Record<string, number> = {
    chat: 20,
    eventCheck: 60,
    memory: 30,
    default: 100,
  };

  const key = `${userId}:${type}`;
  const limit = limits[type] || limits.default;
  const windowMs = 60000; // 1분
  const now = Date.now();

  let record = requestCounts.get(key);

  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + windowMs };
    requestCounts.set(key, record);
  }

  record.count++;

  return {
    success: record.count <= limit,
    remaining: Math.max(0, limit - record.count),
    reset: record.resetAt,
  };
}
```

**API 라우트 적용**

```typescript
// app/api/ai/chat/route.ts

import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rate-limit';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit 체크
  const rateLimit = await checkRateLimit(user.id, 'chat');
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.reset);
  }

  // ... 나머지 로직
}
```

---

### 2.4 Database 인덱스 부족

- **상태**: [ ] 미완료
- **파일**: `supabase/migrations/` (새 마이그레이션)
- **예상 시간**: 1시간
- **위험도**: Medium (성능)

#### 문제점

자주 사용되는 복합 쿼리에 최적화된 인덱스가 없음.

#### 수정 방법

```sql
-- supabase/migrations/017_performance_indexes.sql

-- ============================================
-- 성능 최적화 인덱스
-- ============================================

-- 1. persona_memories: 활성 기억 + 중요도 정렬 조회
CREATE INDEX IF NOT EXISTS idx_persona_memories_active_importance
  ON persona_memories(user_id, persona_id, importance_score DESC)
  WHERE is_active = true;

-- 2. persona_memories: 타입별 조회
CREATE INDEX IF NOT EXISTS idx_persona_memories_type_active
  ON persona_memories(user_id, persona_id, memory_type)
  WHERE is_active = true;

-- 3. conversation_messages: 세션별 최신 메시지 조회
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_seq
  ON conversation_messages(session_id, sequence_number DESC);

-- 4. conversation_messages: 시간순 조회
CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_time
  ON conversation_messages(session_id, created_at DESC);

-- 5. scheduled_events: 대기 중 이벤트 처리
CREATE INDEX IF NOT EXISTS idx_scheduled_events_pending
  ON scheduled_events(status, scheduled_for)
  WHERE status = 'pending';

-- 6. scheduled_events: 유저별 이벤트 조회
CREATE INDEX IF NOT EXISTS idx_scheduled_events_user_persona_status
  ON scheduled_events(user_id, persona_id, status);

-- 7. event_trigger_logs: 분석용 시간순 조회
CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_time
  ON event_trigger_logs(created_at DESC);

-- 8. event_trigger_logs: 유저별 트리거 이력
CREATE INDEX IF NOT EXISTS idx_event_trigger_logs_user_time
  ON event_trigger_logs(user_id, persona_id, created_at DESC);

-- 9. user_scenario_progress: 진행 중 시나리오 조회
CREATE INDEX IF NOT EXISTS idx_scenario_progress_active
  ON user_scenario_progress(user_id, persona_id, status)
  WHERE status = 'in_progress';

-- 10. conversation_sessions: 유저별 최신 세션
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_updated
  ON conversation_sessions(user_id, updated_at DESC);

-- 11. user_persona_relationships: 해금된 페르소나
CREATE INDEX IF NOT EXISTS idx_relationships_unlocked
  ON user_persona_relationships(user_id, is_unlocked)
  WHERE is_unlocked = true;
```

---

### 2.5 필드명 오류 수정

- **상태**: [ ] 미완료
- **파일**: `app/api/memory/route.ts:105-108`
- **예상 시간**: 30분
- **위험도**: Medium (런타임 에러)

#### 문제점

존재하지 않는 컬럼명 사용으로 런타임 에러 발생.

#### 현재 코드

```typescript
// app/api/memory/route.ts:105-108

affection: rel.affection_level || 0,  // 잘못됨
trust: rel.trust_level || 0,
intimacy: rel.intimacy_level || 0,
stage: rel.current_stage || 'stranger',  // 잘못됨
```

#### 수정 방법

```typescript
// app/api/memory/route.ts:105-108

affection: rel.affection || 0,  // 수정
trust: rel.trust_level || 0,
intimacy: rel.intimacy_level || 0,
stage: rel.relationship_stage || 'stranger',  // 수정
```

---

## 3. Medium Priority Issues

### 3.1 메모리 패턴 과도한 매칭

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/memory-service.ts:245-273`
- **예상 시간**: 3시간
- **위험도**: Low (데이터 품질)

#### 문제점

"좋아" 같은 일상 단어도 메모리로 저장됨. False positive가 많아 데이터 품질 저하.

#### 수정 방법

```typescript
// lib/ai-agent/memory-service.ts

// extractMemoryFromText 메서드 수정
private extractMemoryFromText(
  text: string,
  speaker: 'user' | 'persona'
): MemoryExtractionResult[] {
  const results: MemoryExtractionResult[] = [];
  const normalizedText = text.toLowerCase();

  for (const [memoryType, { keywords, patterns }] of Object.entries(MEMORY_PATTERNS)) {
    let confidence = 0;
    let matchType: 'pattern' | 'keyword' | null = null;

    // 1. 패턴 매칭 (더 신뢰도 높음)
    const patternMatch = patterns.some(pattern => pattern.test(text));
    if (patternMatch) {
      confidence += 0.7;
      matchType = 'pattern';
    }

    // 2. 키워드 매칭 (보조)
    const matchedKeywords = keywords.filter(keyword =>
      normalizedText.includes(keyword.toLowerCase())
    );
    if (matchedKeywords.length > 0) {
      // 매칭된 키워드 수에 따라 점수 부여
      confidence += Math.min(0.3, matchedKeywords.length * 0.1);
      if (!matchType) matchType = 'keyword';
    }

    // 3. 문맥 길이 보너스 (긴 문장은 더 의미있을 가능성)
    if (text.length > 50) {
      confidence += 0.1;
    }

    // 4. 최소 신뢰도 임계값 (0.6 이상만 저장)
    const MIN_CONFIDENCE = 0.6;
    if (confidence >= MIN_CONFIDENCE && matchType) {
      results.push({
        shouldSave: true,
        memoryType: memoryType as MemoryType,
        summary: this.generateSummary(text, memoryType as MemoryType, speaker),
        details: {
          originalText: text.substring(0, 200),
          speaker,
          confidence,
          matchType,
          matchedKeywords: matchedKeywords.slice(0, 3),
        },
        emotionalWeight: this.calculateEmotionalWeight(memoryType as MemoryType),
        importanceScore: this.calculateImportanceScore(memoryType as MemoryType, confidence),
      });
    }
  }

  // 중복 제거 (같은 텍스트에서 여러 타입 매칭 시 가장 높은 것만)
  return this.deduplicateResults(results);
}

private calculateImportanceScore(memoryType: MemoryType, confidence: number): number {
  const baseScores: Record<MemoryType, number> = {
    first_meeting: 10,
    promise: 8,
    secret_shared: 9,
    conflict: 7,
    reconciliation: 8,
    intimate_moment: 9,
    gift_received: 6,
    milestone: 8,
    user_preference: 5,
    emotional_event: 7,
    location_memory: 5,
    nickname: 6,
    inside_joke: 5,
    important_date: 7,
  };

  const base = baseScores[memoryType] || 5;
  // 신뢰도에 따라 조정 (-2 ~ +0)
  const adjustment = Math.floor((confidence - 0.6) * 5);

  return Math.max(1, Math.min(10, base + adjustment));
}

private deduplicateResults(results: MemoryExtractionResult[]): MemoryExtractionResult[] {
  if (results.length <= 1) return results;

  // 신뢰도 높은 순으로 정렬
  results.sort((a, b) => (b.details?.confidence || 0) - (a.details?.confidence || 0));

  // 상위 2개만 반환 (하나의 메시지에서 너무 많은 기억 추출 방지)
  return results.slice(0, 2);
}
```

---

### 3.2 incrementMessages 미호출

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/ai-agent.ts`
- **예상 시간**: 30분
- **위험도**: Low (통계 부정확)

#### 문제점

`updateRelationship`에 `incrementMessages` 파라미터가 있지만 호출 시 사용되지 않음.

#### 수정 방법

```typescript
// lib/ai-agent/ai-agent.ts - processMessage 메서드 내

// 기존 코드 찾기
await this.updateRelationship(session.userId, session.personaId, {
  affectionChange: llmResponse.affectionModifier,
  flagsToSet: llmResponse.flagsToSet,
});

// 수정
await this.updateRelationship(session.userId, session.personaId, {
  affectionChange: llmResponse.affectionModifier,
  flagsToSet: llmResponse.flagsToSet,
  incrementMessages: true,  // 추가
});
```

---

### 3.3 Connection Pool 미설정

- **상태**: [ ] 미완료
- **파일**: `lib/supabase-server.ts` 또는 관련 파일
- **예상 시간**: 1시간
- **위험도**: Low (고부하 시 문제)

#### 문제점

각 API 호출마다 새 Supabase 클라이언트 생성. 고부하 시 연결 고갈 가능.

#### 수정 방법

```typescript
// lib/supabase-server.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 싱글톤 클라이언트
let supabaseServerClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (supabaseServerClient) {
    return supabaseServerClient;
  }

  supabaseServerClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      // DB 설정
      db: {
        schema: 'public',
      },
      // 글로벌 설정
      global: {
        headers: {
          'x-application-name': 'ai-novel-server',
        },
      },
    }
  );

  return supabaseServerClient;
}

// 유저 컨텍스트가 필요한 경우 (RLS)
export function createUserSupabase(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}
```

---

### 3.4 이벤트 조회 컬럼 오류

- **상태**: [ ] 미완료
- **파일**: `app/api/ai/events/pending/route.ts:19-26`
- **예상 시간**: 30분
- **위험도**: Medium (런타임 에러)

#### 문제점

`priority` 컬럼이 `scheduled_events` 테이블에 없음.

#### 수정 방법

```typescript
// app/api/ai/events/pending/route.ts:19-26

// 기존 (잘못된 코드)
.select(`
  id,
  persona_id,
  event_type,
  priority,          // <- 없는 컬럼
  scheduled_for,
  event_data
`)

// 수정
.select(`
  id,
  persona_id,
  event_type,
  scheduled_for,
  event_data,
  trigger_rule_id
`)
```

---

### 3.5 Upsert Conflict Key 문제

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/memory-service.ts:159-173`
- **예상 시간**: 2시간
- **위험도**: Low (데이터 중복)

#### 문제점

4개 컬럼 조합으로 unique 체크하는데, summary가 조금만 달라도 중복 저장됨.

#### 수정 방법

```typescript
// lib/ai-agent/memory-service.ts

// saveMemory 메서드 수정
async saveMemory(memory: Omit<Memory, 'id' | 'createdAt'>): Promise<Memory | null> {
  // 1. 유사 기억 체크 (최근 24시간 내 같은 타입)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: similarMemories } = await this.supabase
    .from('persona_memories')
    .select('id, summary')
    .eq('user_id', memory.userId)
    .eq('persona_id', memory.personaId)
    .eq('memory_type', memory.memoryType)
    .eq('is_active', true)
    .gt('created_at', oneDayAgo);

  // 2. 유사도 체크 (간단한 구현)
  if (similarMemories && similarMemories.length > 0) {
    const isDuplicate = similarMemories.some(existing =>
      this.calculateSimilarity(existing.summary, memory.summary) > 0.7
    );

    if (isDuplicate) {
      console.log('[MemoryService] Similar memory exists, skipping save');
      return null;
    }
  }

  // 3. 저장
  const { data, error } = await this.supabase
    .from('persona_memories')
    .insert({
      user_id: memory.userId,
      persona_id: memory.personaId,
      memory_type: memory.memoryType,
      summary: memory.summary,
      details: memory.details,
      emotional_weight: memory.emotionalWeight,
      importance_score: memory.importanceScore,
      affection_at_time: memory.affectionAtTime,
      source_type: memory.sourceType || 'dm',
      source_id: memory.sourceId,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[MemoryService] Failed to save memory:', error);
    return null;
  }

  return this.mapMemory(data);
}

// 간단한 유사도 계산 (Jaccard similarity)
private calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
```

---

### 3.6 Memory 조회 시 Limit 미적용

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/ai-agent.ts:563-567`
- **예상 시간**: 1시간
- **위험도**: Low (컨텍스트 오버플로우)

#### 문제점

LLM 컨텍스트 구성 시 메모리를 과도하게 로드하면 토큰 한도 초과.

#### 수정 방법

```typescript
// lib/ai-agent/ai-agent.ts - buildLLMContext 메서드

async buildLLMContext(
  session: ConversationSession,
  recentMessages: ConversationMessage[]
): Promise<LLMContext> {
  const MAX_CONTEXT_TOKENS = 4000;
  let estimatedTokens = 0;

  // 1. 최근 메시지 (필수, 최대 10개)
  const messagesToInclude = recentMessages.slice(-10);
  estimatedTokens += messagesToInclude.length * 50; // 대략적 추정

  // 2. 기억 (토큰 여유 있을 때만)
  let memories: PersonaMemory[] = [];
  if (estimatedTokens < MAX_CONTEXT_TOKENS - 500) {
    const maxMemories = Math.floor((MAX_CONTEXT_TOKENS - estimatedTokens - 500) / 100);
    memories = await this.memoryManager.getMemoriesForPrompt(
      session.userId,
      session.personaId,
      Math.min(maxMemories, 10)
    );
    estimatedTokens += memories.length * 100;
  }

  // 3. 이전 대화 요약 (토큰 여유 있을 때만)
  let summaries: ConversationSummary[] = [];
  if (estimatedTokens < MAX_CONTEXT_TOKENS - 200) {
    summaries = await this.memoryManager.getSummariesForPrompt(
      session.userId,
      session.personaId,
      3 // 최대 3개
    );
  }

  return {
    messages: messagesToInclude,
    memories,
    summaries,
    estimatedTokens,
  };
}
```

---

## 4. Low Priority Issues

### 4.1 Soft Delete 미지원

- **상태**: [ ] 미완료
- **파일**: DB 마이그레이션
- **예상 시간**: 2시간

```sql
-- 추가 마이그레이션
ALTER TABLE event_trigger_rules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE scenario_templates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 조회 시 필터 추가 필요
-- .is('deleted_at', null)
```

---

### 4.2 Request Timeout 설정 없음

- **상태**: [ ] 미완료
- **파일**: API 라우트
- **예상 시간**: 1시간

```typescript
// lib/utils/timeout.ts

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

// 사용
const result = await withTimeout(agent.processMessage(...), 30000);
```

---

### 4.3 Audit Logging 미구현

- **상태**: [ ] 미완료
- **파일**: 새 서비스 파일
- **예상 시간**: 4시간

```typescript
// lib/services/audit-service.ts

export async function auditLog(
  supabase: SupabaseClient,
  event: {
    userId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
  }
): Promise<void> {
  await supabase.from('audit_logs').insert({
    user_id: event.userId,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId,
    changes: event.changes,
    ip_address: event.ipAddress,
    created_at: new Date().toISOString(),
  });
}
```

---

### 4.4 N+1 쿼리 문제 (DM 목록)

- **상태**: [ ] 미완료
- **파일**: `app/api/dm/list/route.ts:61-90`
- **예상 시간**: 2시간

```typescript
// 개선된 쿼리 (JOIN 사용)
const { data } = await supabase
  .from('conversation_sessions')
  .select(`
    id,
    persona_id,
    updated_at,
    messages:conversation_messages(
      content,
      created_at,
      sender
    )
  `)
  .eq('user_id', userId)
  .order('updated_at', { ascending: false });
```

---

### 4.5 PersonaLoader 캐시 TTL 없음

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/persona-loader.ts`
- **예상 시간**: 1시간

```typescript
// TTL 추가
private cache = new Map<string, { data: PersonaCoreData; timestamp: number }>();
private CACHE_TTL_MS = 3600000; // 1시간

async loadPersona(personaId: string): Promise<PersonaCoreData | null> {
  const cached = this.cache.get(personaId);
  if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
    return cached.data;
  }

  // 새로 로드...
}
```

---

### 4.6 Memory Context Overflow

- **상태**: [ ] 미완료
- **파일**: `lib/ai-agent/ai-agent.ts`
- **예상 시간**: 2시간

(3.6에서 함께 처리)

---

## 5. Database Migration 추가 사항

새로 필요한 마이그레이션 파일들:

```
supabase/migrations/
├── 017_atomic_token_functions.sql    # 1.2 토큰 원자적 차감
├── 018_error_logs.sql                # 1.3 에러 로깅
├── 019_performance_indexes.sql       # 2.4 성능 인덱스
└── 020_audit_logs.sql                # 4.3 감사 로그 (선택)
```

---

## 6. 진행 상황 트래킹

### Critical Issues
- [ ] 1.1 delivery_conditions 구현
- [ ] 1.2 토큰 차감 Race Condition 수정
- [ ] 1.3 메모리 추출 에러 핸들링
- [ ] 1.4 이벤트 중복 방지
- [ ] 1.5 세션 검증 강화

### High Priority
- [ ] 2.1 메모리 만료 시스템
- [ ] 2.2 입력 검증 (Zod)
- [ ] 2.3 Rate Limiting
- [ ] 2.4 DB 인덱스 추가
- [ ] 2.5 필드명 오류 수정

### Medium Priority
- [ ] 3.1 메모리 패턴 정밀화
- [ ] 3.2 incrementMessages 호출
- [ ] 3.3 Connection Pool
- [ ] 3.4 이벤트 조회 컬럼 수정
- [ ] 3.5 Upsert 중복 방지
- [ ] 3.6 Memory Limit 적용

### Low Priority
- [ ] 4.1 Soft Delete
- [ ] 4.2 Request Timeout
- [ ] 4.3 Audit Logging
- [ ] 4.4 N+1 쿼리 수정
- [ ] 4.5 캐시 TTL
- [ ] 4.6 Context Overflow

---

> 마지막 업데이트: 2025-12-03
