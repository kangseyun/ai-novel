import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { getKlingAIClient, PERSONA_IMAGE_PROMPTS, SCENE_PROMPTS } from '@/lib/kling-ai';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/admin/generate-images
 * 페르소나 피드 이미지 생성 (관리자용)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // TODO: 관리자 권한 체크 추가
    // if (!user.is_admin) return unauthorized();

    const { personaId, sceneKey, additionalPrompt, batchGenerate } = await request.json();

    const kling = getKlingAIClient();

    // 일괄 생성 모드
    if (batchGenerate) {
      const allScenes = Object.keys(SCENE_PROMPTS).filter(key => key.startsWith(`${personaId}_`));

      const results = await kling.generateBatchFeedImages(
        allScenes.map(sceneKey => ({ personaId, sceneKey }))
      );

      return NextResponse.json({
        success: true,
        generated: results.length,
        results,
      });
    }

    // 단일 이미지 생성
    if (!personaId || !sceneKey) {
      return badRequest('personaId and sceneKey are required');
    }

    const urls = await kling.generatePersonaFeedImage(personaId, sceneKey, additionalPrompt);

    return NextResponse.json({
      success: true,
      personaId,
      sceneKey,
      urls,
    });
  } catch (error) {
    console.error('[Generate Images] Error:', error);
    return serverError(error);
  }
}

/**
 * GET /api/admin/generate-images
 * 사용 가능한 프롬프트 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    return NextResponse.json({
      personas: Object.keys(PERSONA_IMAGE_PROMPTS).map(id => ({
        id,
        name: PERSONA_IMAGE_PROMPTS[id].personaName,
        basePrompt: PERSONA_IMAGE_PROMPTS[id].basePrompt,
      })),
      scenes: Object.keys(SCENE_PROMPTS).map(key => ({
        key,
        prompt: SCENE_PROMPTS[key],
        personaId: key.split('_')[0],
      })),
    });
  } catch (error) {
    console.error('[Generate Images] Error:', error);
    return serverError(error);
  }
}
