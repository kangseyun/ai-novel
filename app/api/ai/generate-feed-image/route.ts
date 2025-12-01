import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import { getKlingAIClient, PERSONA_IMAGE_PROMPTS } from '@/lib/kling-ai';

/**
 * POST /api/ai/generate-feed-image
 * AI가 피드에 올릴 이미지 동적 생성
 * - 이벤트 트리거로 호출됨
 * - 페르소나 상황에 맞는 이미지 생성
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const {
      personaId,
      situation, // 현재 상황 설명
      mood, // 감정 상태
      aspectRatio = '1:1',
    } = await request.json();

    if (!personaId || !situation) {
      return badRequest('personaId and situation are required');
    }

    const personaPrompt = PERSONA_IMAGE_PROMPTS[personaId];
    if (!personaPrompt) {
      return badRequest(`Unknown persona: ${personaId}`);
    }

    // 상황에 맞는 프롬프트 조합
    const moodMapping: Record<string, string> = {
      happy: 'genuine smile, bright expression, cheerful mood',
      sad: 'melancholic expression, subtle sadness, contemplative',
      mysterious: 'enigmatic smile, mysterious aura, alluring gaze',
      flirty: 'playful smile, suggestive look, charming expression',
      tired: 'tired but attractive, sleepy eyes, relaxed pose',
      angry: 'intense gaze, stern expression, controlled anger',
      longing: 'wistful expression, distant look, romantic mood',
      possessive: 'intense stare, possessive aura, dark charm',
    };

    const moodPrompt = mood ? moodMapping[mood] || '' : '';

    const fullPrompt = [
      personaPrompt.basePrompt,
      situation,
      moodPrompt,
      personaPrompt.style,
    ].filter(Boolean).join(', ');

    const kling = getKlingAIClient();

    // 이미지 생성 요청
    const task = await kling.createImageTask({
      model_name: 'kling-v2-1',
      prompt: fullPrompt,
      negative_prompt: personaPrompt.negativePrompt,
      aspect_ratio: aspectRatio as '1:1' | '16:9' | '9:16' | '4:3',
      resolution: '1k',
      n: 1,
    });

    // 비동기로 완료 대기 (클라이언트에 태스크 ID 반환)
    return NextResponse.json({
      success: true,
      taskId: task.data.task_id,
      status: task.data.task_status,
      message: 'Image generation started. Poll /api/ai/generate-feed-image/status for completion.',
    });
  } catch (error) {
    console.error('[Generate Feed Image] Error:', error);
    return serverError(error);
  }
}
