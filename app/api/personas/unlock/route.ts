import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

// 페르소나별 팔로우 비용 (토큰)
const FOLLOW_COST = 10; // 팔로우 기본 비용

// 프리미엄 페르소나는 추가 비용
const PREMIUM_FOLLOW_COSTS: Record<string, number> = {
  daniel: 100,
  kael: 100,
  adrian: 150,
  ren: 200,
};

// 새로고침 비용
const REFRESH_COST = 5;

/**
 * POST /api/personas/unlock
 * 프리미엄 페르소나 해금 (토큰 차감)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await request.json();

    if (!personaId) {
      return badRequest('personaId is required');
    }

    // jun은 기본 해금이므로 구매 불가
    if (personaId === 'jun') {
      return badRequest('Jun is already unlocked by default');
    }

    // 프리미엄 페르소나는 추가 비용, 일반은 기본 비용
    const unlockCost = PREMIUM_FOLLOW_COSTS[personaId] || FOLLOW_COST;

    const supabase = await createClient();

    // 1. 현재 유저 토큰 확인
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tokens')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[Unlock] User fetch error:', userError);
      throw userError;
    }

    const currentTokens = userData?.tokens || 0;

    if (currentTokens < unlockCost) {
      return NextResponse.json(
        {
          success: false,
          message: '토큰이 부족합니다',
          required: unlockCost,
          current: currentTokens,
        },
        { status: 400 }
      );
    }

    // 2. 이미 해금되어 있는지 확인
    const { data: existingRelation } = await supabase
      .from('user_persona_relationships')
      .select('id, is_unlocked')
      .eq('user_id', user.id)
      .eq('persona_id', personaId)
      .single();

    if (existingRelation?.is_unlocked) {
      return NextResponse.json(
        {
          success: false,
          message: '이미 해금된 페르소나입니다',
        },
        { status: 400 }
      );
    }

    // 3. 트랜잭션: 토큰 차감 + 관계 생성/업데이트
    // 토큰 차감
    const { error: tokenError } = await supabase
      .from('users')
      .update({
        tokens: currentTokens - unlockCost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (tokenError) {
      console.error('[Unlock] Token deduction error:', tokenError);
      throw tokenError;
    }

    // 관계 생성/업데이트
    const relationData = {
      user_id: user.id,
      persona_id: personaId,
      is_unlocked: true,
      unlocked_at: new Date().toISOString(),
      affection: 0,
      relationship_stage: 'stranger',
    };

    if (existingRelation) {
      // 기존 관계 업데이트
      const { error: updateError } = await supabase
        .from('user_persona_relationships')
        .update({
          is_unlocked: true,
          unlocked_at: new Date().toISOString(),
        })
        .eq('id', existingRelation.id);

      if (updateError) {
        console.error('[Unlock] Relation update error:', updateError);
        throw updateError;
      }
    } else {
      // 새 관계 생성
      const { error: insertError } = await supabase
        .from('user_persona_relationships')
        .insert(relationData);

      if (insertError) {
        console.error('[Unlock] Relation insert error:', insertError);
        throw insertError;
      }
    }

    // 4. 구매 기록 저장
    await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        type: 'persona_unlock',
        amount: unlockCost,
        price: 0, // 토큰으로 구매
        currency: 'tokens',
        metadata: { persona_id: personaId },
      });

    return NextResponse.json({
      success: true,
      personaId,
      tokensSpent: unlockCost,
      remainingTokens: currentTokens - unlockCost,
    });

  } catch (error) {
    console.error('[Unlock] Error:', error);
    return serverError(error);
  }
}

/**
 * GET /api/personas/unlock
 * 해금된 페르소나 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = await createClient();

    const { data: relationships, error } = await supabase
      .from('user_persona_relationships')
      .select('persona_id, is_unlocked, unlocked_at')
      .eq('user_id', user.id)
      .eq('is_unlocked', true);

    if (error) {
      console.error('[Unlock List] Error:', error);
      throw error;
    }

    // jun은 항상 포함
    const unlockedIds = ['jun', ...(relationships?.map(r => r.persona_id) || [])];
    const uniqueIds = [...new Set(unlockedIds)];

    return NextResponse.json({
      unlockedPersonas: uniqueIds,
      details: relationships || [],
    });

  } catch (error) {
    console.error('[Unlock List] Error:', error);
    return serverError(error);
  }
}
