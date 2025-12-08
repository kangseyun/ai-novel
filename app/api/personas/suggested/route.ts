import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';
import { createClient } from '@/lib/supabase-server';

// ============================================
// 설정값 (쉽게 수정 가능)
// ============================================
const REFRESH_COST = 5; // 유료 새로고침 비용 (토큰)
const FREE_REFRESH_INTERVAL_MINUTES = 10; // 무료 새로고침 간격 (분)

/**
 * GET /api/personas/suggested
 * 추천 페르소나 목록 조회 (팔로우하지 않은 페르소나)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const supabase = await createClient();

    // 이미 팔로우한 페르소나 목록
    const { data: following } = await supabase
      .from('user_persona_relationships')
      .select('persona_id')
      .eq('user_id', user.id)
      .eq('is_unlocked', true);

    const followedIds = following?.map(f => f.persona_id) || [];
    // jun은 기본 팔로우로 추천 목록에서 제외
    followedIds.push('jun');

    // 페르소나 목록 조회 (팔로우하지 않은 것만)
    const { data: personas, error } = await supabase
      .from('personas')
      .select('id, name, display_name, username, bio, avatar_url, is_verified, is_premium, category')
      .not('id', 'in', `(${followedIds.join(',')})`)
      .eq('is_active', true)
      .limit(5);

    if (error) {
      console.error('[Suggested] Error:', error);
      throw error;
    }

    // 유저 토큰 및 마지막 새로고침 시간 조회
    const { data: userData } = await supabase
      .from('users')
      .select('tokens, last_suggestion_refresh_at')
      .eq('id', user.id)
      .single();

    // 다음 무료 새로고침까지 남은 시간 계산
    const lastRefreshAt = userData?.last_suggestion_refresh_at
      ? new Date(userData.last_suggestion_refresh_at)
      : null;
    const now = new Date();
    const nextFreeRefreshAt = lastRefreshAt
      ? new Date(lastRefreshAt.getTime() + FREE_REFRESH_INTERVAL_MINUTES * 60 * 1000)
      : now; // 처음이면 바로 가능

    const canFreeRefresh = !lastRefreshAt || now >= nextFreeRefreshAt;
    const secondsUntilFreeRefresh = canFreeRefresh
      ? 0
      : Math.ceil((nextFreeRefreshAt.getTime() - now.getTime()) / 1000);

    return NextResponse.json({
      personas: personas || [],
      userTokens: userData?.tokens || 0,
      refreshCost: REFRESH_COST,
      freeRefreshIntervalMinutes: FREE_REFRESH_INTERVAL_MINUTES,
      canFreeRefresh,
      secondsUntilFreeRefresh,
      nextFreeRefreshAt: nextFreeRefreshAt.toISOString(),
    });

  } catch (error) {
    console.error('[Suggested] Error:', error);
    return serverError(error);
  }
}

/**
 * POST /api/personas/suggested
 * 추천 페르소나 새로고침
 * - useFreeRefresh=true: 무료 새로고침 (쿨다운 체크)
 * - useFreeRefresh=false 또는 미지정: 토큰 소모 새로고침
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const useFreeRefresh = body.useFreeRefresh === true;

    const supabase = await createClient();

    // 1. 현재 유저 정보 확인
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tokens, last_suggestion_refresh_at')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[Refresh] User fetch error:', userError);
      throw userError;
    }

    const currentTokens = userData?.tokens || 0;
    const lastRefreshAt = userData?.last_suggestion_refresh_at
      ? new Date(userData.last_suggestion_refresh_at)
      : null;
    const now = new Date();

    // 2. 무료 새로고침 vs 유료 새로고침 처리
    let tokensSpent = 0;
    let newTokens = currentTokens;

    if (useFreeRefresh) {
      // 무료 새로고침 쿨다운 체크
      const nextFreeRefreshAt = lastRefreshAt
        ? new Date(lastRefreshAt.getTime() + FREE_REFRESH_INTERVAL_MINUTES * 60 * 1000)
        : now;

      if (lastRefreshAt && now < nextFreeRefreshAt) {
        const secondsRemaining = Math.ceil((nextFreeRefreshAt.getTime() - now.getTime()) / 1000);
        return NextResponse.json(
          {
            success: false,
            message: '무료 새로고침 쿨다운 중입니다',
            secondsUntilFreeRefresh: secondsRemaining,
            canFreeRefresh: false,
          },
          { status: 400 }
        );
      }

      // 무료 새로고침 - 시간만 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update({
          last_suggestion_refresh_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('[Refresh] Free refresh update error:', updateError);
        throw updateError;
      }
    } else {
      // 유료 새로고침 - 토큰 체크 및 차감
      if (currentTokens < REFRESH_COST) {
        return NextResponse.json(
          {
            success: false,
            message: '토큰이 부족합니다',
            required: REFRESH_COST,
            current: currentTokens,
          },
          { status: 400 }
        );
      }

      tokensSpent = REFRESH_COST;
      newTokens = currentTokens - REFRESH_COST;

      const { error: tokenError } = await supabase
        .from('users')
        .update({
          tokens: newTokens,
          updated_at: now.toISOString(),
        })
        .eq('id', user.id);

      if (tokenError) {
        console.error('[Refresh] Token deduction error:', tokenError);
        throw tokenError;
      }
    }

    // 3. 이미 팔로우한 페르소나 목록
    const { data: following } = await supabase
      .from('user_persona_relationships')
      .select('persona_id')
      .eq('user_id', user.id)
      .eq('is_unlocked', true);

    const followedIds = following?.map(f => f.persona_id) || [];
    followedIds.push('jun');

    // 4. 새로운 추천 페르소나 (랜덤 정렬)
    const { data: personas, error } = await supabase
      .from('personas')
      .select('id, name, display_name, username, bio, avatar_url, is_verified, is_premium, category')
      .not('id', 'in', `(${followedIds.join(',')})`)
      .eq('is_active', true)
      .limit(5);

    if (error) {
      console.error('[Refresh] Personas fetch error:', error);
      throw error;
    }

    // 랜덤 셔플
    const shuffled = (personas || []).sort(() => Math.random() - 0.5);

    // 5. 다음 무료 새로고침 정보 계산
    const newLastRefreshAt = useFreeRefresh ? now : lastRefreshAt;
    const nextFreeRefreshAt = newLastRefreshAt
      ? new Date(newLastRefreshAt.getTime() + FREE_REFRESH_INTERVAL_MINUTES * 60 * 1000)
      : new Date(now.getTime() + FREE_REFRESH_INTERVAL_MINUTES * 60 * 1000);

    return NextResponse.json({
      success: true,
      personas: shuffled,
      tokensSpent,
      remainingTokens: newTokens,
      usedFreeRefresh: useFreeRefresh,
      canFreeRefresh: false, // 방금 사용했으면 false
      secondsUntilFreeRefresh: FREE_REFRESH_INTERVAL_MINUTES * 60,
      nextFreeRefreshAt: nextFreeRefreshAt.toISOString(),
    });

  } catch (error) {
    console.error('[Refresh] Error:', error);
    return serverError(error);
  }
}
