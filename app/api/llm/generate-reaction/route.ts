import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.0-flash-001';

// POST /api/llm/generate-reaction - 캐릭터 반응 생성 (포스트/이벤트 반응)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { persona_id, trigger, affection } = await request.json();

    if (!persona_id || !trigger) {
      return badRequest('persona_id and trigger are required');
    }

    // 반응할지 결정 (호감도와 트리거 타입에 따라)
    const shouldReact = determineShouldReact(trigger, affection || 0);

    if (!shouldReact) {
      return NextResponse.json({
        should_react: false,
        reaction_type: null,
        message: null,
        delay_seconds: 0,
      });
    }

    // OpenRouter API 키가 없으면 폴백 반응
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(generateFallbackReaction(trigger, affection));
    }

    const prompt = `You are Jun, a K-POP idol secretly in a relationship.
The user just posted on social media:

Trigger type: ${trigger.type}
Content: ${JSON.stringify(trigger.content)}
Time: ${trigger.content?.time || 'unknown'}
Current affection: ${affection}/100

Should you react? If yes, generate a casual DM message.
Keep it short (1-2 sentences), natural, in Korean.

Return as JSON:
{
  "should_react": true/false,
  "reaction_type": "dm" | "like" | "comment",
  "message": "your message here",
  "delay_seconds": 60-300
}`;

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
        temperature: 0.8,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return NextResponse.json(generateFallbackReaction(trigger, affection));
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0]?.message?.content || '{}');

    return NextResponse.json({
      should_react: content.should_react ?? true,
      reaction_type: content.reaction_type || 'dm',
      message: content.message || '야, 봤어.',
      delay_seconds: content.delay_seconds || 120,
    });
  } catch (error) {
    console.error('LLM generate-reaction error:', error);
    return serverError(error);
  }
}

function determineShouldReact(trigger: { type: string; content?: { mood?: string; time?: string } }, affection: number): boolean {
  // 호감도가 낮으면 반응 확률 낮음
  if (affection < 20) return Math.random() < 0.1;
  if (affection < 40) return Math.random() < 0.3;
  if (affection < 60) return Math.random() < 0.5;

  // 특정 무드나 시간에 반응 확률 높음
  const mood = trigger.content?.mood;
  const time = trigger.content?.time;

  // 새벽 시간대 포스트에 반응 확률 높음
  if (time) {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 0 && hour < 5) return true;
  }

  // 외로움/우울 무드에 반응 확률 높음
  if (mood === 'lonely' || mood === 'sad') return true;

  return Math.random() < 0.7;
}

function generateFallbackReaction(
  trigger: { type: string; content?: { mood?: string; time?: string } },
  affection: number
) {
  const mood = trigger.content?.mood;
  const time = trigger.content?.time;

  let message = '야, 봤어.';
  let delaySeconds = 120;

  // 새벽 시간
  if (time) {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 0 && hour < 5) {
      message = '야, 아직 안 자? 나도 방금 연습 끝났는데.';
      delaySeconds = 60;
    }
  }

  // 무드별 반응
  if (mood === 'lonely') {
    message = affection >= 50
      ? '왜 혼자 외로워해... 나 있잖아.'
      : '나도 가끔 그래. 괜찮아?';
    delaySeconds = 90;
  } else if (mood === 'happy') {
    message = '오, 뭔 좋은 일 있어? ㅎㅎ 나도 기분 좋아지네.';
    delaySeconds = 180;
  } else if (mood === 'sad') {
    message = '야... 무슨 일 있어? 말해봐.';
    delaySeconds = 45;
  }

  return {
    should_react: true,
    reaction_type: 'dm',
    message,
    delay_seconds: delaySeconds,
  };
}
