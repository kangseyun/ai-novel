import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase-server';
import { ScenarioService } from '@/lib/ai-agent/scenario-service';

/**
 * GET /api/scenario
 * 시나리오 정보 조회
 * - scenarioId: 특정 시나리오 조회
 * - personaId: 첫 만남 시나리오 또는 사용 가능한 시나리오 목록
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('scenarioId');
    const personaId = searchParams.get('personaId');

    const supabase = await createServerClient();
    const scenarioService = new ScenarioService(supabase);

    // 특정 시나리오 조회
    if (scenarioId) {
      const scenario = await scenarioService.getScenario(scenarioId);
      if (!scenario) {
        return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
      }

      // 진행 상태도 함께 조회
      const progress = await scenarioService.getProgress(user.id, scenario.personaId, scenarioId);

      return NextResponse.json({ scenario, progress });
    }

    // 페르소나의 시나리오 목록 조회
    if (personaId) {
      // 유저의 첫 시나리오 완료 여부 확인
      const hasCompleted = await scenarioService.hasCompletedFirstScenario(user.id, personaId);

      if (!hasCompleted) {
        // 첫 만남 시나리오 반환
        const firstScenario = await scenarioService.getFirstMeetingScenario(personaId);

        if (firstScenario) {
          const progress = await scenarioService.getProgress(user.id, personaId, firstScenario.id);
          return NextResponse.json({
            isFirstMeeting: true,
            scenario: firstScenario,
            progress,
          });
        }
      }

      // 유저 관계 정보 조회
      const { data: relationship } = await supabase
        .from('user_persona_relationships')
        .select('affection, relationship_stage')
        .eq('user_id', user.id)
        .eq('persona_id', personaId)
        .single();

      // 사용 가능한 시나리오 목록
      const scenarios = await scenarioService.getAvailableScenarios(
        user.id,
        personaId,
        relationship?.affection || 0,
        relationship?.relationship_stage || 'stranger'
      );

      // 현재 진행 중인 시나리오
      const currentScenario = await scenarioService.getCurrentScenario(user.id, personaId);

      return NextResponse.json({
        isFirstMeeting: false,
        currentScenario,
        availableScenarios: scenarios,
      });
    }

    return badRequest('scenarioId or personaId is required');
  } catch (error) {
    console.error('[Scenario] Error:', error);
    return serverError(error);
  }
}

/**
 * POST /api/scenario
 * 시나리오 시작
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId, scenarioId } = await request.json();

    if (!personaId || !scenarioId) {
      return badRequest('personaId and scenarioId are required');
    }

    const supabase = await createServerClient();
    const scenarioService = new ScenarioService(supabase);

    // 시나리오 존재 확인
    const scenario = await scenarioService.getScenario(scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // 시나리오 시작
    const progress = await scenarioService.startScenario(user.id, personaId, scenarioId);

    // 유저의 현재 시나리오 업데이트
    await supabase
      .from('users')
      .update({ current_scenario_id: scenarioId })
      .eq('id', user.id);

    return NextResponse.json({
      scenario,
      progress,
      currentScene: scenario.content.scenes[0],
    });
  } catch (error) {
    console.error('[Scenario Start] Error:', error);
    return serverError(error);
  }
}
