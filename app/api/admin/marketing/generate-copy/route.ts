import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

interface GeneratePromptRequest {
  type: 'image_prompt' | 'marketing_concept' | 'marketing_copy';
  // 공통
  persona_name?: string;
  persona_description?: string;
  template?: string;
  template_label?: string;
  // marketing_copy 전용
  concept?: string;
  cta_goal?: string;
  target_platform?: string;
  // 기존 프롬프트가 있으면 개선
  existing_prompt?: string;
}

interface MarketingCopy {
  headline: string;
  body: string;
  cta: string;
}

interface GenerateCopyResponse {
  success: boolean;
  result?: string | MarketingCopy[];
  error?: string;
}

// 이미지 프롬프트 자동 생성
async function generateImagePrompt(
  personaName: string,
  personaDescription: string,
  templateLabel: string,
  existingPrompt?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  const systemPrompt = `You are a creative director specializing in mobile dating app advertisements.
Your task is to create compelling image prompts for AI image generation (Kling AI).

The generated prompts should:
1. Be visually descriptive and specific
2. Focus on creating an emotional connection with the viewer
3. Evoke romance, attraction, and desire to chat
4. Be in English
5. Be concise but detailed (50-100 words)

Output ONLY the prompt text, no explanations or formatting.`;

  const userPrompt = existingPrompt
    ? `Improve and enhance this image prompt for a dating app advertisement:

Character: ${personaName}
Template: ${templateLabel}
Current prompt: "${existingPrompt}"

Make it more visually compelling and emotionally engaging while keeping the core concept.`
    : `Create an image prompt for a dating app advertisement:

Character: ${personaName}
Character Description: ${personaDescription || 'A charming and attractive person'}
Template/Mood: ${templateLabel}

Create a vivid, emotionally engaging scene that would make viewers want to chat with this character.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

// 마케팅 컨셉/CTA 자동 생성
async function generateMarketingConcept(
  personaName: string,
  personaDescription: string,
  targetPlatform: string,
  existingConcept?: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  const systemPrompt = `You are a marketing strategist for mobile dating/chat apps.
Your task is to create compelling marketing concepts that drive app downloads and user engagement.

The concept should include:
1. Core emotional hook (loneliness solution, romantic fantasy, companionship)
2. Unique selling proposition
3. Call-to-action strategy
4. Target audience insight

Keep it concise (2-3 sentences in Korean).
Output ONLY the concept text, no explanations or formatting.`;

  const userPrompt = existingConcept
    ? `Refine this marketing concept for ${targetPlatform} ads:

Character: ${personaName}
Current concept: "${existingConcept}"

Make it more emotionally compelling and conversion-focused.
Output in Korean.`
    : `Create a marketing concept for ${targetPlatform} dating app ads:

Character: ${personaName}
Character Description: ${personaDescription || 'An attractive and charming AI companion'}

Create a concept that will make users want to download the app and chat with this character.
Output in Korean.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

// 마케팅 문구 (제목, 본문, CTA) 다중 버전 생성
async function generateMarketingCopy(
  personaName: string,
  concept: string,
  ctaGoal: string,
  targetPlatform: string,
  versionsCount: number = 3
): Promise<MarketingCopy[]> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  const platformGuide = {
    meta: 'Facebook/Instagram ads with character limits: headline 40자, body 125자, CTA 25자',
    google: 'Google Display ads: headline 30자, body 90자, CTA 15자',
    tiktok: 'TikTok ads: headline 50자, body 100자, CTA 20자',
  }[targetPlatform] || 'Social media ads: keep all texts short and punchy';

  const systemPrompt = `You are an expert copywriter for dating/chat app advertisements.
Create compelling ad copy in Korean that drives downloads and engagement.

Platform: ${platformGuide}

Guidelines:
1. Headlines should be attention-grabbing and emotionally resonant
2. Body text should create desire and curiosity
3. CTA should be action-oriented and compelling
4. Use emojis sparingly but effectively
5. Consider the target audience (mostly young adults seeking connection)

Output Format (JSON array):
[
  {
    "headline": "제목 텍스트",
    "body": "본문 텍스트",
    "cta": "CTA 버튼 텍스트"
  },
  ...
]

Output ONLY the JSON array, no other text.`;

  const userPrompt = `Create ${versionsCount} different versions of ad copy for a dating app:

Character: ${personaName}
Marketing Concept: ${concept}
CTA Goal: ${ctaGoal || 'App download and first chat'}
Platform: ${targetPlatform}

Create ${versionsCount} unique variations with different emotional angles (e.g., romantic, playful, mysterious).
All text should be in Korean.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content?.trim() || '[]';

  try {
    // JSON 파싱 시도
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // JSON 파싱 실패 시 정규식으로 추출 시도
    console.warn('[Generate Copy] Failed to parse JSON, attempting regex extraction');
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.error('[Generate Copy] Regex extraction also failed');
        return [];
      }
    }
    return [];
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateCopyResponse>> {
  try {
    const body: GeneratePromptRequest = await request.json();
    const {
      type,
      persona_name = '캐릭터',
      persona_description = '',
      template_label = '',
      concept = '',
      cta_goal = '',
      target_platform = 'meta',
      existing_prompt = '',
    } = body;

    let result: string | MarketingCopy[];

    switch (type) {
      case 'image_prompt':
        result = await generateImagePrompt(
          persona_name,
          persona_description,
          template_label,
          existing_prompt
        );
        break;

      case 'marketing_concept':
        result = await generateMarketingConcept(
          persona_name,
          persona_description,
          target_platform,
          existing_prompt
        );
        break;

      case 'marketing_copy':
        if (!concept) {
          return NextResponse.json({
            success: false,
            error: 'Marketing concept is required for copy generation',
          }, { status: 400 });
        }
        result = await generateMarketingCopy(
          persona_name,
          concept,
          cta_goal,
          target_platform,
          3 // 3개 버전 생성
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid generation type',
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Generate Copy] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    }, { status: 500 });
  }
}
