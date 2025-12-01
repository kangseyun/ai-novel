import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.0-flash-001';

// POST /api/llm/generate-choices - 동적 선택지 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { persona_id, context, choice_count = 3 } = await request.json();

    if (!persona_id || !context?.situation) {
      return badRequest('persona_id and context.situation are required');
    }

    // OpenRouter API 키가 없으면 폴백 선택지
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({
        choices: generateFallbackChoices(context.mood),
      });
    }

    const prompt = `Given this situation in a romance game with Jun (K-POP idol):
"${context.situation}"

Current mood: ${context.mood || 'neutral'}
Affection level: ${context.affection || 0}/100

Generate ${choice_count} response choices for the player. Each should:
1. Feel natural for someone in a secret relationship
2. Lead to different emotional outcomes
3. Be in Korean, casual speech
4. Be short (under 20 characters each)

Return as JSON: { "choices": [{ "id": "choice1", "text": "선택지 텍스트", "tone": "caring|playful|neutral|cold" }] }`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        choices: generateFallbackChoices(context.mood),
      });
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0]?.message?.content || '{}');

    return NextResponse.json({
      choices: content.choices || generateFallbackChoices(context.mood),
    });
  } catch (error) {
    console.error('LLM generate-choices error:', error);
    return serverError(error);
  }
}

function generateFallbackChoices(mood?: string) {
  const choiceSets: Record<string, Array<{ id: string; text: string; tone: string }>> = {
    happy: [
      { id: 'choice_caring_1', text: '나도 기분 좋아!', tone: 'caring' },
      { id: 'choice_playful_1', text: '뭐가 그렇게 좋아? ㅎㅎ', tone: 'playful' },
      { id: 'choice_neutral_1', text: '그렇구나', tone: 'neutral' },
    ],
    sad: [
      { id: 'choice_caring_1', text: '무슨 일 있어?', tone: 'caring' },
      { id: 'choice_caring_2', text: '내가 곁에 있을게', tone: 'caring' },
      { id: 'choice_neutral_1', text: '...', tone: 'neutral' },
    ],
    urgent: [
      { id: 'choice_caring_1', text: '괜찮아?!', tone: 'caring' },
      { id: 'choice_caring_2', text: '119 불러!', tone: 'caring' },
      { id: 'choice_neutral_1', text: '어떻게 해야 해?', tone: 'neutral' },
    ],
    default: [
      { id: 'choice_caring_1', text: '뭐해?', tone: 'caring' },
      { id: 'choice_playful_1', text: '심심해~', tone: 'playful' },
      { id: 'choice_neutral_1', text: '...', tone: 'neutral' },
    ],
  };

  return choiceSets[mood || 'default'] || choiceSets.default;
}
