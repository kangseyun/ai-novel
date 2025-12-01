import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/memory
 * 유저의 기억 페이지 데이터 (열린 페르소나 목록 + 관계 정보)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = await createClient();

    // 1. 유저와 관계가 형성된 모든 페르소나 조회
    const { data: relationships, error: relError } = await supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', user.id)
      .order('last_interaction_at', { ascending: false });

    if (relError) {
      console.error('[Memory] Relationships error:', relError);
      throw relError;
    }

    // 2. 페르소나 코어 데이터 조회
    const personaIds = relationships?.map(r => r.persona_id) || [];

    let personaCores: Record<string, any> = {};
    if (personaIds.length > 0) {
      const { data: cores, error: coreError } = await supabase
        .from('persona_core')
        .select('id, name, full_name, role, appearance')
        .in('id', personaIds);

      if (!coreError && cores) {
        personaCores = cores.reduce((acc, core) => {
          acc[core.id] = core;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // 3. 각 페르소나별 기억(메모) 조회
    let memoriesByPersona: Record<string, any[]> = {};
    if (personaIds.length > 0) {
      const { data: memories, error: memError } = await supabase
        .from('persona_memories')
        .select('*')
        .eq('user_id', user.id)
        .in('persona_id', personaIds)
        .order('created_at', { ascending: false });

      if (!memError && memories) {
        memoriesByPersona = memories.reduce((acc, mem) => {
          if (!acc[mem.persona_id]) acc[mem.persona_id] = [];
          acc[mem.persona_id].push(mem);
          return acc;
        }, {} as Record<string, any[]>);
      }
    }

    // 4. 시나리오 진행 상태 조회
    let scenarioProgress: Record<string, any> = {};
    if (personaIds.length > 0) {
      const { data: progress, error: progError } = await supabase
        .from('user_scenario_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('persona_id', personaIds);

      if (!progError && progress) {
        scenarioProgress = progress.reduce((acc, prog) => {
          if (!acc[prog.persona_id]) acc[prog.persona_id] = [];
          acc[prog.persona_id].push(prog);
          return acc;
        }, {} as Record<string, any[]>);
      }
    }

    // 5. 결과 조합
    const personas = (relationships || []).map(rel => {
      const core = personaCores[rel.persona_id];
      const memories = memoriesByPersona[rel.persona_id] || [];
      const scenarios = scenarioProgress[rel.persona_id] || [];

      const completedScenarios = scenarios.filter((s: any) => s.status === 'completed').length;
      const totalScenarios = scenarios.length || 1; // 최소 1 (첫 만남 시나리오)

      // 비밀 메모 수 계산
      const secretMemories = memories.filter((m: any) =>
        ['secret_shared', 'intimate_moment', 'milestone'].includes(m.memory_type)
      );

      return {
        id: rel.persona_id,
        name: core?.name || rel.persona_id,
        fullName: core?.full_name || '',
        role: core?.role || '',
        image: core?.appearance?.profile_image || `https://i.pravatar.cc/400?u=${rel.persona_id}`,

        // 관계 수치
        affection: rel.affection_level || 0,
        trust: rel.trust_level || 0,
        intimacy: rel.intimacy_level || 0,
        stage: rel.current_stage || 'stranger',

        // 진행도
        storyProgress: completedScenarios,
        totalStories: Math.max(totalScenarios, 12), // 총 스토리 수 (임시로 12)
        unlockedSecrets: secretMemories.length,
        totalSecrets: 8, // 총 비밀 수 (임시)

        // 메모/기억
        memories: memories.map((m: any) => ({
          id: m.id,
          type: m.memory_type,
          title: getMemoryTitle(m.memory_type),
          content: m.summary,
          details: m.details,
          emotionalWeight: m.emotional_weight,
          createdAt: m.created_at,
          isLocked: false,
        })),

        // 관계 상세
        relationship: getRelationshipLabel(rel.current_stage),
        currentArc: getArcLabel(completedScenarios),

        // 별명
        userNickname: rel.user_nickname,
        personaNickname: rel.persona_nickname,

        // 메타
        totalMessages: rel.total_messages || 0,
        firstInteractionAt: rel.first_interaction_at,
        lastInteractionAt: rel.last_interaction_at,
      };
    });

    // 6. 전체 통계
    const stats = {
      totalCharacters: personas.length,
      totalSecrets: personas.reduce((sum, p) => sum + p.unlockedSecrets, 0),
      totalStories: personas.reduce((sum, p) => sum + p.storyProgress, 0),
    };

    return NextResponse.json({
      personas,
      stats,
    });
  } catch (error) {
    console.error('[Memory] Error:', error);
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
