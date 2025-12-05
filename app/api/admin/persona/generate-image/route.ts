import { NextRequest, NextResponse } from 'next/server';
import { getKlingAIClient } from '@/lib/kling-ai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

interface GenerateImageRequest {
  personaData: {
    name: string;
    role: string;
    age: number;
    ethnicity?: string;
    appearance?: {
      hair?: string;
      eyes?: string;
      build?: string;
      style?: string;
      distinguishingFeatures?: string[];
    };
    core_personality?: {
      surface?: string[];
      core_trope?: string;
    };
  };
  conceptPrompt: string;  // 생성 프롬프트
  imageType: 'profile' | 'full' | 'scene';
  sceneContext?: string;  // 추가 장면 컨텍스트
  customPrompt?: string;  // 사용자 지정 프롬프트 (직접 편집 시)
  previewOnly?: boolean;  // 프롬프트 미리보기만 (이미지 생성 안함)
}

// 한국어를 영어 이미지 프롬프트로 변환
async function translateToEnglishPrompt(koreanData: {
  role?: string;
  appearance?: GenerateImageRequest['personaData']['appearance'];
  personality?: string[];
  conceptPrompt?: string;
}): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    console.warn('OpenRouter API key not found, skipping translation');
    return '';
  }

  const prompt = `You are a professional image prompt translator. Convert the following Korean character description into a concise English image generation prompt.

Focus ONLY on visual elements:
- Physical appearance (hair, eyes, face, body type)
- Clothing and style
- Expression and mood
- Age and ethnicity

Korean Data:
- Role: ${koreanData.role || 'N/A'}
- Hair: ${koreanData.appearance?.hair || 'N/A'}
- Eyes: ${koreanData.appearance?.eyes || 'N/A'}
- Build: ${koreanData.appearance?.build || 'N/A'}
- Style: ${koreanData.appearance?.style || 'N/A'}
- Features: ${koreanData.appearance?.distinguishingFeatures?.join(', ') || 'N/A'}
- Personality traits for expression: ${koreanData.personality?.join(', ') || 'N/A'}
- Concept: ${koreanData.conceptPrompt || 'N/A'}

Return ONLY a comma-separated list of English visual descriptors suitable for image generation. No explanations, just the prompt.
Example output: "young Korean man, black wavy hair, sharp dark brown eyes, tall slim build, wearing casual streetwear, confident smirk"`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v3.2',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    const translatedPrompt = data.choices[0]?.message?.content?.trim() || '';
    console.log('[Image Prompt Translation] Result:', translatedPrompt);
    return translatedPrompt;
  } catch (error) {
    console.error('[Image Prompt Translation] Error:', error);
    return '';
  }
}

// 이미지 스타일 일관성을 위한 기본 템플릿
const BASE_IMAGE_TEMPLATE = {
  style: 'professional photography, Instagram aesthetic, high quality, 4k, detailed face, soft studio lighting, shallow depth of field',
  negativePrompt: 'ugly, deformed, blurry, low quality, bad anatomy, extra limbs, text, watermark, cartoon, anime, 3d render, disfigured, bad proportions, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck',
};

// 이미지 타입별 템플릿
const IMAGE_TYPE_TEMPLATES = {
  profile: {
    aspectRatio: '1:1' as const,
    additionalPrompt: 'close-up portrait, looking at camera, charming expression, natural pose',
  },
  full: {
    aspectRatio: '3:4' as const,
    additionalPrompt: 'full body shot, confident pose, stylish outfit, professional studio background',
  },
  scene: {
    aspectRatio: '16:9' as const,
    additionalPrompt: 'cinematic shot, dramatic lighting, environmental storytelling',
  },
};

function buildPersonaPrompt(data: GenerateImageRequest['personaData'], conceptPrompt: string): string {
  const parts: string[] = [];

  // 기본 정보
  if (data.ethnicity) {
    parts.push(`${data.ethnicity} ${data.age} years old`);
  } else {
    parts.push(`${data.age} years old`);
  }

  // 역할
  if (data.role) {
    parts.push(data.role);
  }

  // 외모
  if (data.appearance) {
    if (data.appearance.hair) parts.push(data.appearance.hair);
    if (data.appearance.eyes) parts.push(data.appearance.eyes);
    if (data.appearance.build) parts.push(data.appearance.build);
    if (data.appearance.style) parts.push(`wearing ${data.appearance.style}`);
    if (data.appearance.distinguishingFeatures?.length) {
      parts.push(data.appearance.distinguishingFeatures.join(', '));
    }
  }

  // 성격에서 표정 힌트
  if (data.core_personality?.surface?.length) {
    const surfaceTraits = data.core_personality.surface.slice(0, 2).join(', ');
    parts.push(`${surfaceTraits} expression`);
  }

  // 컨셉 프롬프트에서 추가 정보 추출
  if (conceptPrompt) {
    // 컨셉에서 시각적 요소만 추출 (간단히)
    const visualKeywords = conceptPrompt.match(/(?:외모|스타일|패션|헤어|눈|체형|분위기)[^,.]*/g);
    if (visualKeywords) {
      parts.push(...visualKeywords);
    }
  }

  return parts.join(', ');
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateImageRequest = await request.json();
    const { personaData, conceptPrompt, imageType, sceneContext, customPrompt, previewOnly } = body;

    const typeTemplate = IMAGE_TYPE_TEMPLATES[imageType];

    // 프롬프트 구성 (customPrompt가 있으면 그것을 사용)
    let fullPrompt: string;
    if (customPrompt) {
      fullPrompt = customPrompt;
    } else {
      // 한국어 데이터를 영어로 번역
      const translatedPrompt = await translateToEnglishPrompt({
        role: personaData.role,
        appearance: personaData.appearance,
        personality: personaData.core_personality?.surface,
        conceptPrompt,
      });

      // 번역된 프롬프트가 있으면 사용, 없으면 기본 빌더 사용
      const personaPrompt = translatedPrompt || buildPersonaPrompt(personaData, conceptPrompt);

      fullPrompt = [
        personaPrompt,
        `${personaData.ethnicity || 'Korean'} ${personaData.age} years old`,
        typeTemplate.additionalPrompt,
        sceneContext,
        BASE_IMAGE_TEMPLATE.style,
      ].filter(Boolean).join(', ');
    }

    // 프롬프트 미리보기만 요청한 경우
    if (previewOnly) {
      return NextResponse.json({
        success: true,
        prompt: fullPrompt,
        negativePrompt: BASE_IMAGE_TEMPLATE.negativePrompt,
        aspectRatio: typeTemplate.aspectRatio,
      });
    }

    console.log('[Image Generation] Prompt:', fullPrompt);

    const klingClient = getKlingAIClient();

    // 이미지 생성 요청
    const task = await klingClient.createImageTask({
      model_name: 'kling-v2-1',
      prompt: fullPrompt,
      negative_prompt: BASE_IMAGE_TEMPLATE.negativePrompt,
      aspect_ratio: typeTemplate.aspectRatio,
      resolution: '1k',
      n: 4,
    });

    return NextResponse.json({
      success: true,
      taskId: task.data.task_id,
      status: task.data.task_status,
      prompt: fullPrompt,
      message: 'Image generation started',
    });
  } catch (error) {
    console.error('Image generation error:', error);

    // Kling API 에러 파싱
    const errorMessage = error instanceof Error ? error.message : 'Image generation failed';

    // 병렬 작업 제한 에러 (code: 1303)
    if (errorMessage.includes('1303') || errorMessage.includes('parallel task over resource pack limit')) {
      return NextResponse.json({
        error: '이미지 생성 대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.',
        errorCode: 'RATE_LIMIT',
        retryAfter: 30, // 30초 후 재시도 권장
      }, { status: 429 });
    }

    // 크레딧 부족 에러
    if (errorMessage.includes('credit') || errorMessage.includes('balance')) {
      return NextResponse.json({
        error: '이미지 생성 크레딧이 부족합니다.',
        errorCode: 'INSUFFICIENT_CREDITS',
      }, { status: 402 });
    }

    return NextResponse.json({
      error: errorMessage
    }, { status: 500 });
  }
}
