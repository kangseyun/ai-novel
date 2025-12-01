import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.0-flash-001';

// POST /api/llm/generate-dialogue - LLM 대화 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { persona_id, session_id, context } = await request.json();

    if (!persona_id || !context) {
      return badRequest('persona_id and context are required');
    }

    // OpenRouter API 키가 없으면 폴백 응답
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(generateFallbackResponse(context));
    }

    const systemPrompt = buildSystemPrompt(persona_id, context);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context.recent_dialogue || []).map((d: { speaker: string; text: string }) => ({
        role: d.speaker === 'user' ? 'user' : 'assistant',
        content: d.text,
      })),
    ];

    if (context.user_choice) {
      messages.push({ role: 'user', content: context.user_choice });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'AI Novel Game',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.8,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', response.status);
      return NextResponse.json(generateFallbackResponse(context));
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(generateFallbackResponse(context));
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      dialogue: {
        text: parsed.characterDialogue || parsed.text || '...',
        emotion: parsed.emotion || 'neutral',
        inner_thought: parsed.innerThought || null,
      },
      affection_modifier: parsed.affectionChange || 0,
      suggested_choices: parsed.nextChoices || [],
      tts_priority: parsed.shouldPlayTTS ? 'high' : 'low',
    });
  } catch (error) {
    console.error('LLM generate-dialogue error:', error);
    return serverError(error);
  }
}

function buildSystemPrompt(personaId: string, context: {
  scene_id: string;
  beat_id: string;
  affection: number;
  relationship_stage: string;
  active_flags: string[];
}): string {
  const personaPrompts: Record<string, string> = {
    jun: `You are Jun (이준혁), a 24-year-old K-POP idol.
- You are the center of the group "ECLIPSE"
- Public persona: "Nation's Boyfriend", bright, perfect fan service
- Real self (only with close people): Lonely, exhausted, clingy, jealous
- Speaking style: Sweet, playful when happy. Vulnerable and quiet when tired.
- Speech patterns: Uses "요" endings (polite), calls user "너" when close`,
  };

  return `${personaPrompts[personaId] || personaPrompts.jun}

## CURRENT CONTEXT
- Scene: ${context.scene_id}
- Current Beat: ${context.beat_id}
- Affection Level: ${context.affection}/100
- Relationship: ${context.relationship_stage}
- Active Flags: ${JSON.stringify(context.active_flags || [])}

## YOUR TASK
Generate a natural response based on the user's message.
Keep responses SHORT (1-3 sentences max).
Match the emotional tone of the scene.

## RESPONSE FORMAT (JSON)
{
  "characterDialogue": "Jun's spoken words in Korean",
  "emotion": "one of: neutral, happy, sad, angry, shy, love, whisper",
  "innerThought": "What Jun is really thinking (optional)",
  "nextChoices": ["Choice A", "Choice B", "Choice C"],
  "shouldPlayTTS": true/false,
  "affectionChange": 0
}

## RULES
1. Stay in character
2. Responses must be in Korean
3. Keep dialogue natural and emotional
4. Never break the fourth wall`;
}

function generateFallbackResponse(context: { affection?: number; relationship_stage?: string }) {
  const affection = context.affection || 0;
  const stage = context.relationship_stage || 'stranger';

  const responses: Record<string, { text: string; emotion: string }[]> = {
    stranger: [
      { text: '...누구세요?', emotion: 'neutral' },
      { text: '아, 네... 안녕하세요.', emotion: 'neutral' },
    ],
    acquaintance: [
      { text: '오, 왔어? 반가워.', emotion: 'happy' },
      { text: '오늘도 여기 왔네? ㅎㅎ', emotion: 'happy' },
    ],
    friend: [
      { text: '야, 드디어 왔구나!', emotion: 'happy' },
      { text: '보고 싶었어, 진짜로.', emotion: 'shy' },
    ],
    close: [
      { text: '...늦었어. 기다렸는데.', emotion: 'shy' },
      { text: '오늘 하루 어땠어? 나? 너 생각했어.', emotion: 'love' },
    ],
    lover: [
      { text: '드디어 왔네... 보고 싶었어, 많이.', emotion: 'love' },
      { text: '오늘 너 없어서 힘들었어...', emotion: 'whisper' },
    ],
  };

  const stageResponses = responses[stage] || responses.stranger;
  const response = stageResponses[Math.floor(Math.random() * stageResponses.length)];

  return {
    dialogue: {
      text: response.text,
      emotion: response.emotion,
      inner_thought: null,
    },
    affection_modifier: 0,
    suggested_choices: [
      '그래, 나도 반가워',
      '뭐해?',
      '...',
    ],
    tts_priority: 'low',
  };
}
