import { NextRequest, NextResponse } from 'next/server';
import { getKlingAIClient } from '@/lib/kling-ai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

// 메타 광고 사이즈 프리셋 (Kling AI 지원 비율로 매핑)
const AD_SIZES = {
  'feed-square': { width: 1080, height: 1080, label: '피드 정사각형 (1:1)', aspectRatio: '1:1' as const },
  'feed-portrait': { width: 1080, height: 1350, label: '피드 세로형 (4:5)', aspectRatio: '3:4' as const }, // 4:5에 가까운 3:4 사용
  'story': { width: 1080, height: 1920, label: '스토리/릴스 (9:16)', aspectRatio: '9:16' as const },
  'carousel': { width: 1080, height: 1080, label: '캐러셀 (1:1)', aspectRatio: '1:1' as const },
} as const;

// 광고 템플릿
const AD_TEMPLATES = {
  'romantic-chat': {
    label: '로맨틱 채팅 유도',
    promptGuide: '캐릭터가 폰을 들고 메시지를 보내는 듯한 친밀한 분위기, 살짝 웃는 표정, 부드러운 조명',
  },
  'mysterious-encounter': {
    label: '미스터리한 첫만남',
    promptGuide: '캐릭터가 시선을 끄는 매력적인 포즈, 드라마틱한 조명, 영화 같은 분위기',
  },
  'daily-life': {
    label: '일상 속 순간',
    promptGuide: '캐릭터의 자연스러운 일상 모습, 카페/거리/사무실 등 현실적인 배경',
  },
  'special-moment': {
    label: '특별한 순간',
    promptGuide: '캐릭터가 선물을 주거나 깜짝 이벤트를 준비하는 로맨틱한 순간',
  },
  'confession': {
    label: '고백/설렘',
    promptGuide: '수줍게 고백하거나 설레는 표정의 캐릭터, 핑크톤 조명, 로맨틱한 배경',
  },
};

interface GenerateAdRequest {
  personaData?: {
    name: string;
    role: string;
    age: number;
    ethnicity?: string;
    appearance?: {
      hair?: string;
      eyes?: string;
      build?: string;
      style?: string;
    };
    core_personality?: {
      surface?: string[];
    };
  };
  adSize: keyof typeof AD_SIZES;
  template: keyof typeof AD_TEMPLATES;
  customPrompt?: string;
  includeText?: boolean;
  adText?: string;
  // 참조 이미지 기반 생성 (사이즈 변환용) - 베이스 이미지 URL
  referenceImageUrl?: string;
  // 생성할 이미지 개수 (1~4, 기본값 4)
  imageCount?: number;
}

// 광고 이미지 프롬프트 생성
function buildAdPrompt(
  personaData: NonNullable<GenerateAdRequest['personaData']>,
  template: keyof typeof AD_TEMPLATES,
  customPrompt?: string
): string {
  const templateInfo = AD_TEMPLATES[template];

  // 캐릭터 외모 설명
  const appearanceDesc = [
    personaData.ethnicity || 'Korean',
    `${personaData.age} years old`,
    personaData.appearance?.hair,
    personaData.appearance?.eyes,
    personaData.appearance?.build,
    personaData.appearance?.style ? `wearing ${personaData.appearance.style}` : null,
  ].filter(Boolean).join(', ');

  // 성격에서 표정 힌트
  const expressionHint = personaData.core_personality?.surface?.slice(0, 2).join(' and ') || 'charming';

  const basePrompt = `Professional advertisement photo for a mobile dating app.
${appearanceDesc}.
${templateInfo.promptGuide}.
Expression: ${expressionHint}.
High-end fashion photography style, Instagram aesthetic, soft studio lighting, shallow depth of field.
Modern, clean, appealing to young women.
NO text, NO watermark, NO logo.`;

  return customPrompt ? `${basePrompt}\n\nAdditional context: ${customPrompt}` : basePrompt;
}

// 참조 이미지 기반 사이즈 변환용 프롬프트
function buildResizePrompt(
  template: keyof typeof AD_TEMPLATES,
  customPrompt?: string
): string {
  const templateInfo = AD_TEMPLATES[template];

  // 참조 이미지가 있을 때는 동일한 인물을 유지하면서 비율만 변경
  const basePrompt = `Same person, same face, same appearance, same clothing.
${templateInfo.promptGuide}.
High-end fashion photography style, Instagram aesthetic, soft studio lighting, shallow depth of field.
Modern, clean, appealing to young women.
Maintain exact same person identity.
NO text, NO watermark, NO logo.`;

  return customPrompt ? `${basePrompt}\n\nAdditional context: ${customPrompt}` : basePrompt;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateAdRequest = await request.json();
    const { personaData, adSize, template, customPrompt, referenceImageUrl, imageCount } = body;

    const sizeInfo = AD_SIZES[adSize];

    // 참조 이미지가 있으면 사이즈 변환 모드, 없으면 새 이미지 생성 모드
    const isResizeMode = !!referenceImageUrl;

    // 프롬프트 생성 - 참조 이미지가 있으면 동일 인물 유지 프롬프트 사용
    let translatedPrompt: string;
    if (isResizeMode) {
      translatedPrompt = buildResizePrompt(template, customPrompt);
    } else {
      if (!personaData) {
        return NextResponse.json({
          error: '캐릭터 데이터가 필요합니다.'
        }, { status: 400 });
      }
      translatedPrompt = buildAdPrompt(personaData, template, customPrompt);
    }

    if (OPENROUTER_API_KEY) {
      try {
        const translateRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          },
          body: JSON.stringify({
            model: 'deepseek/deepseek-v3.2',
            messages: [{
              role: 'user',
              content: `You are a professional image prompt translator. Convert the following advertisement description into a concise English image generation prompt.

Focus ONLY on visual elements for creating a high-quality photo:
- Physical appearance details
- Clothing and accessories
- Expression and pose
- Lighting and mood
- Background/setting

Description to translate:
${translatedPrompt}

Return ONLY a comma-separated list of English visual descriptors suitable for image generation. No explanations, just the prompt.`
            }],
            temperature: 0.3,
            max_tokens: 512,
          }),
        });

        if (translateRes.ok) {
          const translateData = await translateRes.json();
          const englishPrompt = translateData.choices[0]?.message?.content?.trim();
          if (englishPrompt) {
            translatedPrompt = englishPrompt;
          }
        }
      } catch (e) {
        console.warn('[Marketing] Translation failed, using original prompt:', e);
      }
    }

    const actualImageCount = isResizeMode ? 1 : Math.min(Math.max(imageCount || 4, 1), 4);
    console.log('[Marketing Ad Generation] Prompt:', translatedPrompt);
    console.log('[Marketing Ad Generation] Size:', sizeInfo);
    console.log('[Marketing Ad Generation] Reference Image:', isResizeMode ? 'Yes' : 'No');
    console.log('[Marketing Ad Generation] Requested imageCount:', imageCount, '-> Actual:', actualImageCount);

    const klingClient = getKlingAIClient();

    // Kling AI로 이미지 생성 요청
    // 참조 이미지가 있으면 image 파라미터로 전달하여 동일 인물 유지
    const task = await klingClient.createImageTask({
      model_name: 'kling-v2-1',
      prompt: translatedPrompt,
      negative_prompt: 'ugly, deformed, blurry, low quality, bad anatomy, extra limbs, text, watermark, cartoon, anime, 3d render, disfigured, bad proportions, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, too many fingers, long neck, different person, different face',
      aspect_ratio: sizeInfo.aspectRatio,
      resolution: '1k',
      n: actualImageCount, // 1~4개, 기본 4개
      // 참조 이미지 기반 생성 (동일 인물 유지)
      ...(isResizeMode && referenceImageUrl && {
        image: referenceImageUrl,
        image_reference: 'subject' as const, // 주체(인물) 유지
        image_fidelity: 0.85, // 높은 충실도로 동일 인물 유지
      }),
    });

    return NextResponse.json({
      success: true,
      taskId: task.data.task_id,
      status: task.data.task_status,
      prompt: translatedPrompt,
      message: 'Image generation started',
    });
  } catch (error) {
    console.error('[Marketing Ad Generation] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Ad generation failed';

    // Kling API 에러 처리
    if (errorMessage.includes('1303') || errorMessage.includes('parallel task over resource pack limit')) {
      return NextResponse.json({
        error: '이미지 생성 대기열이 가득 찼습니다. 잠시 후 다시 시도해주세요.',
        errorCode: 'RATE_LIMIT',
        retryAfter: 30,
      }, { status: 429 });
    }

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

// 템플릿 목록 반환 (GET)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  // taskId가 있으면 상태 조회
  if (taskId) {
    try {
      const klingClient = getKlingAIClient();
      const status = await klingClient.getTaskStatus(taskId);

      return NextResponse.json({
        success: true,
        taskId: status.data.task_id,
        status: status.data.task_status,
        statusMessage: status.data.task_status_msg,
        images: status.data.task_result?.images || [],
      });
    } catch (error) {
      console.error('[Marketing] Task status check error:', error);
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Failed to check task status'
      }, { status: 500 });
    }
  }

  // taskId가 없으면 설정 반환
  return NextResponse.json({
    sizes: AD_SIZES,
    templates: AD_TEMPLATES,
  });
}
