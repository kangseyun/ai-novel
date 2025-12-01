import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase-server';
import { ScenarioService } from '@/lib/ai-agent/scenario-service';
import { MemoryManager } from '@/lib/ai-agent/memory-system';

/**
 * POST /api/scenario/advance
 * 시나리오 진행 (선택지 선택, 다음 씬 이동)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId, scenarioId, choiceId, sceneId, nextSceneId } = await request.json();

    if (!personaId || !scenarioId) {
      return badRequest('personaId and scenarioId are required');
    }

    const supabase = await createServerClient();
    const scenarioService = new ScenarioService(supabase);
    const memoryManager = new MemoryManager(supabase);

    // 시나리오 조회
    const scenario = await scenarioService.getScenario(scenarioId);
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // 선택지 정보 찾기
    let choiceMade: { sceneId: string; choiceId: string } | undefined;
    let affectionChange = 0;
    let flagToSet: string | undefined;

    if (choiceId && sceneId) {
      const currentScene = scenario.content.scenes.find(s => s.id === sceneId);
      if (currentScene?.choices) {
        const choice = currentScene.choices.find(c => c.id === choiceId);
        if (choice) {
          choiceMade = { sceneId, choiceId };
          affectionChange = choice.affectionChange || 0;
          flagToSet = choice.flag;
        }
      }
    }

    // 진행 상태 업데이트
    const targetSceneId = nextSceneId || choiceMade?.choiceId;
    if (!targetSceneId) {
      return badRequest('nextSceneId or choiceId is required');
    }

    const progress = await scenarioService.advanceScene(
      user.id,
      personaId,
      scenarioId,
      targetSceneId,
      choiceMade
    );

    // 호감도 변화 적용
    if (affectionChange !== 0) {
      const { data: relationship } = await supabase
        .from('user_persona_relationships')
        .select('affection, story_flags')
        .eq('user_id', user.id)
        .eq('persona_id', personaId)
        .single();

      const newAffection = Math.max(0, Math.min(100, (relationship?.affection || 0) + affectionChange));
      const updatedFlags = {
        ...(relationship?.story_flags || {}),
        ...(flagToSet ? { [flagToSet]: true } : {}),
      };

      await supabase
        .from('user_persona_relationships')
        .update({
          affection: newAffection,
          story_flags: updatedFlags,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('persona_id', personaId);
    }

    // 다음 씬 찾기
    const nextScene = scenario.content.scenes.find(s => s.id === targetSceneId);

    // 시나리오 종료 확인
    const isEnding = !nextScene || !scenario.content.scenes.some(s =>
      s.choices?.some(c => c.nextScene) && s.id === targetSceneId
    );

    if (isEnding) {
      // 첫 만남 시나리오 완료 처리
      if (scenario.scenarioType === 'first_meeting') {
        // 첫 만남 기억 저장
        await memoryManager.saveMemory(user.id, personaId, {
          type: 'first_meeting',
          summary: `${scenario.title} - 첫 만남 시나리오 완료`,
          details: {
            scenarioId,
            choices: progress.choicesMade,
          },
          emotionalWeight: 10,
          affectionAtTime: affectionChange,
        });

        // 시나리오 완료 처리
        await scenarioService.completeScenario(user.id, personaId, scenarioId, {
          finalAffection: affectionChange,
          flagsToSet: flagToSet ? { [flagToSet]: true } : {},
        });

        return NextResponse.json({
          progress,
          currentScene: nextScene,
          isEnding: true,
          endingData: scenario.content.endingConditions,
          message: '첫 만남 시나리오가 완료되었습니다. DM 채팅이 활성화됩니다.',
        });
      }
    }

    return NextResponse.json({
      progress,
      currentScene: nextScene,
      isEnding: false,
      affectionChange,
    });
  } catch (error) {
    console.error('[Scenario Advance] Error:', error);
    return serverError(error);
  }
}
