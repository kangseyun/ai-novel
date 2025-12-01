import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/memory/:personaId
 * 특정 페르소나와의 상세 기억 정보
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await params;

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const supabase = await createClient();

    // 1. 관계 정보 조회
    const { data: relationship, error: relError } = await supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .single();

    // 관계가 없으면 빈 데이터 반환 (아직 DM 안 열림)
    if (relError && relError.code === 'PGRST116') {
      return NextResponse.json({
        exists: false,
        message: 'No relationship found with this persona',
      });
    }

    if (relError) {
      throw relError;
    }

    // 2. 페르소나 코어 데이터
    const { data: core } = await supabase
      .from('persona_core')
      .select('*')
      .eq('id', personaId)
      .single();

    // 3. 모든 기억 조회
    const { data: memories } = await supabase
      .from('persona_memories')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false });

    // 4. 대화 요약 조회
    const { data: summaries } = await supabase
      .from('conversation_summaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .order('created_at', { ascending: false })
      .limit(10);

    // 5. 시나리오 진행 상태
    const { data: scenarios } = await supabase
      .from('user_scenario_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId);

    const completedScenarios = scenarios?.filter(s => s.status === 'completed') || [];

    // 6. 관계 스탯 계산
    const stats = {
      trust: relationship.trust_level || 0,
      intimacy: relationship.intimacy_level || 0,
      mystery: calculateMystery(memories || [], completedScenarios.length),
      chemistry: calculateChemistry(relationship),
      loyalty: calculateLoyalty(relationship, memories || []),
    };

    // 7. 잠긴 메모 생성 (아직 해금되지 않은 것들)
    const unlockedMemoryTypes = new Set((memories || []).map((m: any) => m.memory_type));
    const allMemoryTypes = [
      'first_meeting', 'promise', 'secret_shared', 'conflict',
      'reconciliation', 'intimate_moment', 'gift_received', 'milestone'
    ];
    const lockedMemos = allMemoryTypes
      .filter(type => !unlockedMemoryTypes.has(type))
      .map(type => ({
        id: `locked_${type}`,
        type,
        title: getMemoryTitle(type),
        content: '???',
        isLocked: true,
        unlockCondition: getUnlockCondition(type, relationship.current_stage),
      }));

    // 8. 결과 조합
    const result = {
      exists: true,
      persona: {
        id: personaId,
        name: core?.name || personaId,
        fullName: core?.full_name || '',
        role: core?.role || '',
        image: core?.appearance?.profile_image || `https://i.pravatar.cc/400?u=${personaId}`,
      },
      relationship: {
        stage: relationship.current_stage || 'stranger',
        stageLabel: getRelationshipLabel(relationship.current_stage),
        affection: relationship.affection_level || 0,
        trust: relationship.trust_level || 0,
        intimacy: relationship.intimacy_level || 0,
        totalMessages: relationship.total_messages || 0,
        firstInteractionAt: relationship.first_interaction_at,
        lastInteractionAt: relationship.last_interaction_at,
        userNickname: relationship.user_nickname,
        personaNickname: relationship.persona_nickname,
      },
      stats,
      progress: {
        storyProgress: completedScenarios.length,
        totalStories: 12, // 임시
        currentArc: getArcLabel(completedScenarios.length),
        unlockedSecrets: (memories || []).filter((m: any) =>
          ['secret_shared', 'intimate_moment'].includes(m.memory_type)
        ).length,
        totalSecrets: 8, // 임시
      },
      memories: (memories || []).map((m: any) => ({
        id: m.id,
        type: m.memory_type,
        title: getMemoryTitle(m.memory_type),
        content: m.summary,
        details: m.details,
        emotionalWeight: m.emotional_weight,
        createdAt: m.created_at,
        isLocked: false,
      })),
      lockedMemos,
      recentSummaries: (summaries || []).map((s: any) => ({
        id: s.id,
        type: s.summary_type,
        summary: s.summary,
        topics: s.topics,
        emotionalArc: s.emotional_arc,
        periodStart: s.period_start,
        periodEnd: s.period_end,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Memory Detail] Error:', error);
    return serverError(error);
  }
}

/**
 * POST /api/memory/:personaId
 * 새 기억 추가 (DM/시나리오에서 호출)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await params;
    const body = await request.json();

    const { memoryType, summary, details, emotionalWeight } = body;

    if (!memoryType || !summary) {
      return badRequest('memoryType and summary are required');
    }

    const supabase = await createClient();

    // 기억 추가
    const { data: memory, error } = await supabase
      .from('persona_memories')
      .insert({
        user_id: user.id,
        persona_id: personaId,
        memory_type: memoryType,
        summary,
        details: details || {},
        emotional_weight: emotionalWeight || 5,
      })
      .select()
      .single();

    if (error) {
      // 중복 기억은 무시
      if (error.code === '23505') {
        return NextResponse.json({ success: true, duplicate: true });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      memory: {
        id: memory.id,
        type: memory.memory_type,
        title: getMemoryTitle(memory.memory_type),
        content: memory.summary,
      },
    });
  } catch (error) {
    console.error('[Memory Create] Error:', error);
    return serverError(error);
  }
}

// 헬퍼 함수들
function getMemoryTitle(type: string): string {
  const titles: Record<string, string> = {
    first_meeting: '첫 만남',
    promise: '약속',
    secret_shared: '비밀',
    conflict: '갈등',
    reconciliation: '화해',
    intimate_moment: '특별한 순간',
    gift_received: '선물',
    milestone: '기념일',
    user_preference: '취향',
    emotional_event: '감정적 사건',
    location_memory: '함께 간 곳',
    nickname: '별명',
    inside_joke: '둘만의 농담',
    important_date: '중요한 날',
  };
  return titles[type] || type;
}

function getRelationshipLabel(stage: string): string {
  const labels: Record<string, string> = {
    stranger: '처음',
    acquaintance: '아는 사이',
    friend: '친구',
    close: '가까운 사이',
    intimate: '특별한 사이',
    lover: '연인',
  };
  return labels[stage] || stage;
}

function getArcLabel(completedScenarios: number): string {
  if (completedScenarios === 0) return 'Prologue: 시작';
  if (completedScenarios < 3) return `Chapter 1: 첫 만남`;
  if (completedScenarios < 6) return `Chapter 2: 가까워지는 마음`;
  if (completedScenarios < 9) return `Chapter 3: 흔들리는 감정`;
  return `Chapter 4: 진심`;
}

function getUnlockCondition(type: string, currentStage: string): string {
  const conditions: Record<string, string> = {
    first_meeting: '첫 만남 시나리오 완료',
    promise: '친구 단계 이상',
    secret_shared: '친밀도 50 이상',
    conflict: '갈등 이벤트 발생',
    reconciliation: '갈등 해결',
    intimate_moment: '특별한 사이 이상',
    gift_received: '선물 주고받기',
    milestone: '관계 진전',
  };
  return conditions[type] || '더 알아가면 기록됨';
}

function calculateMystery(memories: any[], completedScenarios: number): number {
  // 해금된 비밀이 많을수록 미스터리가 줄어듦
  const totalSecrets = 8;
  const unlockedSecrets = memories.filter(m =>
    ['secret_shared', 'intimate_moment'].includes(m.memory_type)
  ).length;
  return Math.max(0, 100 - (unlockedSecrets / totalSecrets) * 100 - completedScenarios * 5);
}

function calculateChemistry(relationship: any): number {
  // 호감도 + 친밀도 기반
  const affection = relationship.affection_level || 0;
  const intimacy = relationship.intimacy_level || 0;
  return Math.min(100, Math.round((affection + intimacy) / 2));
}

function calculateLoyalty(relationship: any, memories: any[]): number {
  // 총 메시지 수 + 약속 관련 기억
  const messages = relationship.total_messages || 0;
  const promises = memories.filter(m => m.memory_type === 'promise').length;
  const reconciliations = memories.filter(m => m.memory_type === 'reconciliation').length;
  return Math.min(100, Math.round(messages / 10 + promises * 10 + reconciliations * 15));
}
