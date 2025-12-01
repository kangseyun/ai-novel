/**
 * OpenRouter + Gemini API Integration
 *
 * 동적 시나리오 생성 엔진
 * - 시나리오 틀은 유지하되, 대화는 동적으로 생성
 * - 유저 선택에 따라 분기
 * - 캐릭터 일관성 유지
 */

export interface ScenarioContext {
  personaId: string;
  episodeId: string;
  sceneId: string;
  previousMessages: ChatMessage[];
  userChoice?: string;
  affectionLevel: number;
  flags: Record<string, boolean>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GeneratedResponse {
  characterDialogue: string;
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'shy' | 'love' | 'whisper';
  innerThought?: string;      // 캐릭터 내면 (유저에게 안 보임, 다음 생성에 사용)
  nextChoices?: string[];     // 다음 선택지 (있으면)
  shouldPlayTTS?: boolean;    // TTS 재생 여부
  ttsHookType?: 'whisper' | 'confession' | 'emotional_peak' | 'cliffhanger';
  affectionChange?: number;   // 호감도 변화
  flagUpdates?: Record<string, boolean>;
}

class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private model = 'google/gemini-2.0-flash-001'; // 빠른 응답

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '';
  }

  /**
   * 시나리오 컨텍스트 기반 응답 생성
   */
  async generateResponse(context: ScenarioContext): Promise<GeneratedResponse> {
    const systemPrompt = this.buildSystemPrompt(context);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...context.previousMessages,
    ];

    if (context.userChoice) {
      messages.push({ role: 'user', content: context.userChoice });
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
          'X-Title': 'Luminovel.ai',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.8,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from API');
      }

      return JSON.parse(content) as GeneratedResponse;
    } catch (error) {
      console.error('[OpenRouter] Generation Error:', error);
      // 폴백: 기본 응답
      return {
        characterDialogue: '...',
        emotion: 'neutral',
      };
    }
  }

  /**
   * 시스템 프롬프트 구성
   */
  private buildSystemPrompt(context: ScenarioContext): string {
    return `You are an AI dialogue writer for an interactive romance novel game.

## CHARACTER: Jun (이준혁)
- 24 years old K-POP idol, center of group "ECLIPSE"
- Public persona: "Nation's Boyfriend", bright, perfect fan service
- Real self (only with user): Lonely, exhausted, clingy, jealous
- Speaking style: Sweet, playful when happy. Vulnerable and quiet when tired.
- Speech patterns: Uses "요" endings (polite), calls user "누나" or just "you"

## CURRENT CONTEXT
- Episode: ${context.episodeId}
- Scene: ${context.sceneId}
- Affection Level: ${context.affectionLevel}/100
- Active Flags: ${JSON.stringify(context.flags)}

## YOUR TASK
Generate Jun's response based on the user's choice/action.
Keep responses SHORT (1-3 sentences max for dialogue).
Match the emotional tone of the scene.

## RESPONSE FORMAT (JSON)
{
  "characterDialogue": "Jun's spoken words in Korean",
  "emotion": "one of: neutral, happy, sad, angry, shy, love, whisper",
  "innerThought": "What Jun is really thinking (optional, for context)",
  "nextChoices": ["Choice A", "Choice B", "Choice C"] // if user should choose
  "shouldPlayTTS": true/false, // true only for impactful moments
  "ttsHookType": "whisper|confession|emotional_peak|cliffhanger", // if shouldPlayTTS
  "affectionChange": 0, // -5 to +5
  "flagUpdates": {} // any flags to update
}

## RULES
1. Stay in character as Jun
2. Responses must be in Korean
3. Keep dialogue natural and emotional
4. Only set shouldPlayTTS=true for KEY moments (confessions, emotional peaks)
5. Respect the scenario structure but allow organic conversation
6. Never break the fourth wall
7. Be romantic but tasteful`;
  }

  /**
   * 선택지 생성
   */
  async generateChoices(
    context: ScenarioContext,
    situation: string
  ): Promise<string[]> {
    const prompt = `Given this situation in a romance game with Jun (K-POP idol):
"${situation}"

Generate 3 response choices for the player. Each should:
1. Feel natural and in-character for someone in a secret relationship
2. Lead to different emotional outcomes
3. Be in Korean, casual speech

Return as JSON: { "choices": ["choice1", "choice2", "choice3"] }`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
          max_tokens: 256,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json();
      const content = JSON.parse(data.choices[0]?.message?.content || '{}');
      return content.choices || [];
    } catch (error) {
      console.error('[OpenRouter] Choice Generation Error:', error);
      return ['계속', '뭐라고요?', '...'];
    }
  }
}

export const openRouterService = new OpenRouterService();
