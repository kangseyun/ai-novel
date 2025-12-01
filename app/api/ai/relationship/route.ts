import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/ai/relationship?personaId=xxx
 * 특정 페르소나와의 관계 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const supabase = await createClient();

    const { data: relationship, error } = await supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Relationship] DB error:', error);
      throw error;
    }

    // 관계가 없으면 기본값 반환
    if (!relationship) {
      return NextResponse.json({
        personaId,
        stage: 'stranger',
        affectionLevel: 0,
        trustLevel: 0,
        intimacyLevel: 0,
        totalInteractions: 0,
        unlockedMemories: [],
        relationshipMilestones: [],
        lastInteractionAt: null,
      });
    }

    return NextResponse.json({
      personaId: relationship.persona_id,
      stage: relationship.current_stage,
      affectionLevel: relationship.affection_level,
      trustLevel: relationship.trust_level,
      intimacyLevel: relationship.intimacy_level,
      totalInteractions: relationship.total_interactions,
      unlockedMemories: relationship.unlocked_memories || [],
      relationshipMilestones: relationship.relationship_milestones || [],
      lastInteractionAt: relationship.last_interaction_at,
    });
  } catch (error) {
    console.error('[Relationship] Error:', error);
    return serverError(error);
  }
}

/**
 * POST /api/ai/relationship
 * 관계 상태 업데이트 (주로 내부 사용)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId, changes } = await request.json();

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const supabase = await createClient();

    // 현재 관계 상태 조회
    const { data: existing } = await supabase
      .from('user_persona_relationships')
      .select('*')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .single();

    const currentAffection = existing?.affection_level || 0;
    const currentTrust = existing?.trust_level || 0;
    const currentIntimacy = existing?.intimacy_level || 0;
    const totalInteractions = (existing?.total_interactions || 0) + 1;

    // 새 수치 계산
    const newAffection = Math.max(0, Math.min(100, currentAffection + (changes.affection || 0)));
    const newTrust = Math.max(0, Math.min(100, currentTrust + (changes.trust || 0)));
    const newIntimacy = Math.max(0, Math.min(100, currentIntimacy + (changes.intimacy || 0)));

    // 스테이지 자동 계산
    const avgLevel = (newAffection + newTrust + newIntimacy) / 3;
    let newStage = 'stranger';
    if (avgLevel >= 80) newStage = 'lover';
    else if (avgLevel >= 60) newStage = 'intimate';
    else if (avgLevel >= 40) newStage = 'close';
    else if (avgLevel >= 20) newStage = 'acquaintance';

    const updateData = {
      user_id: user.id,
      persona_id: personaId,
      current_stage: newStage,
      affection_level: newAffection,
      trust_level: newTrust,
      intimacy_level: newIntimacy,
      total_interactions: totalInteractions,
      last_interaction_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('user_persona_relationships')
      .upsert(updateData, { onConflict: 'user_id,persona_id' })
      .select()
      .single();

    if (error) {
      console.error('[Relationship Update] DB error:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      relationship: {
        stage: updated.current_stage,
        affectionLevel: updated.affection_level,
        trustLevel: updated.trust_level,
        intimacyLevel: updated.intimacy_level,
        stageChanged: existing?.current_stage !== updated.current_stage,
        previousStage: existing?.current_stage,
      },
    });
  } catch (error) {
    console.error('[Relationship Update] Error:', error);
    return serverError(error);
  }
}
