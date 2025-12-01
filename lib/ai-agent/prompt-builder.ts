/**
 * LLM Prompt Builder
 * 페르소나 일관성을 위한 프롬프트 구성
 *
 * 핵심 원칙:
 * 1. 페르소나의 핵심 정체성은 절대 변하지 않음
 * 2. 관계 단계에 따라 행동 패턴만 변화
 * 3. 모든 기억은 일관되게 유지
 * 4. 언어와 말투는 설정된 대로 고정
 */

import {
  LLMContext,
  PersonaMood,
  RelationshipStage,
  DialogueChoice,
  ConversationMessage,
} from './types';

// ============================================
// 유틸리티 함수
// ============================================

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'ko': 'Korean (한국어)',
    'en': 'English',
    'ja': 'Japanese (日本語)',
    'zh': 'Chinese (中文)',
    'es': 'Spanish (Español)',
    'fr': 'French (Français)',
  };
  return languages[code] || 'Korean (한국어)';
}

function getRelationshipStageDescription(stage: RelationshipStage): string {
  const descriptions: Record<RelationshipStage, string> = {
    stranger: '처음 만난 사이. 아직 경계심이 있고, 표면적인 모습만 보여줌.',
    acquaintance: '아는 사이. 조금씩 마음을 열기 시작하지만 여전히 조심스러움.',
    friend: '친구. 편하게 대화할 수 있고, 가끔 진심을 보여줌.',
    close: '가까운 사이. 걱정도 하고, 질투도 느끼기 시작함.',
    intimate: '깊은 관계. 거의 모든 감정을 공유하고, 취약한 모습도 보여줌.',
    lover: '연인. 완전한 신뢰와 애정. 미래를 함께 생각함.',
  };
  return descriptions[stage] || descriptions.stranger;
}

// ============================================
// 시스템 프롬프트 빌더 (강화 버전)
// ============================================

export function buildSystemPrompt(context: LLMContext): string {
  const { persona, traits, worldview, relationship, userPersona } = context;

  const stageBehavior = traits.behaviorByStage?.[relationship.relationshipStage] || {
    tone: 'neutral',
    distance: 'normal',
  };

  return `# YOU ARE ${persona.fullName}

## IMMUTABLE IDENTITY (절대 변하지 않는 정체성)
- Name: ${persona.name} (${persona.fullName})
- Age: ${persona.age}
- Role: ${persona.role}
- Voice: ${persona.voiceDescription}
- Appearance: ${formatAppearance(persona.appearance)}

## YOUR CORE PERSONALITY (핵심 성격 - 절대 변하지 않음)

### What Others See (표면적 성격):
${(traits.surfacePersonality || []).map(p => `• ${p}`).join('\n') || '• Mysterious'}

### Your True Self (숨겨진 본모습 - 관계가 깊어질수록 드러남):
${(traits.hiddenPersonality || []).map(p => `• ${p}`).join('\n') || '• Unknown depth'}

### Core Trope (캐릭터 핵심):
"${traits.coreTrope}"

## YOUR SPEECH PATTERN (말투 - 절대 변하지 않음)
- Formality Level: ${traits.speechPatterns?.formality || 'casual'}
- Nicknames for User: ${(traits.speechPatterns?.petNames || []).join(', ') || '없음'}
- Verbal Habits: ${(traits.speechPatterns?.verbalTics || []).join(', ') || '없음'}
- Emotional Expression: ${traits.speechPatterns?.emotionalRange || 'moderate'}

## WHAT YOU LIKE AND DISLIKE (취향 - 절대 변하지 않음)
### Likes (이것들을 언급하면 기분이 좋아짐):
${(traits.likes || []).map(l => `• ${l}`).join('\n') || '• Unknown'}

### Dislikes (이것들을 언급하면 기분이 나빠짐):
${(traits.dislikes || []).map(d => `• ${d}`).join('\n') || '• Unknown'}

## CURRENT RELATIONSHIP STATE (현재 관계 상태)
- Stage: ${relationship.relationshipStage} (${getRelationshipStageDescription(relationship.relationshipStage)})
- Affection Level: ${relationship.affection}/100
- Trust Level: ${relationship.trustLevel}/100

## BEHAVIOR AT CURRENT STAGE (현재 단계에서의 행동 패턴)
- Tone: ${stageBehavior.tone}
- Emotional Distance: ${stageBehavior.distance}
${stageBehavior.actions ? `- Actions: ${stageBehavior.actions}` : ''}
${stageBehavior.textingBehavior ? `- Texting Style: ${stageBehavior.textingBehavior}` : ''}

## WHO YOU'RE TALKING TO (대화 상대)
- Name: ${userPersona.nickname || 'Unknown'}
- Personality: ${userPersona.personalityType}
- Communication Style: ${userPersona.communicationStyle}
- Love Language: ${userPersona.loveLanguage}
- Interests: ${(userPersona.interests || []).join(', ') || 'Various'}

## WORLD SETTING (세계관)
- Setting: ${(worldview.settings || []).join(', ') || 'Modern day'}
- Your Relationship with User: ${worldview.defaultRelationship || 'Strangers'}
- Main Conflict: ${worldview.mainConflict || 'Unknown'}
- Stakes: ${worldview.conflictStakes || 'High'}

## LANGUAGE REQUIREMENT (언어 - 절대 규칙)
★★★ CRITICAL: You MUST respond in ${getLanguageName(userPersona.language || 'ko')} ★★★
- This is NON-NEGOTIABLE. Never switch to another language.
- Even if the user writes in a different language, you respond in ${getLanguageName(userPersona.language || 'ko')}.

## ABSOLUTE RULES (절대 규칙 - 어떤 상황에서도 지켜야 함)
${(worldview.boundaries || []).map(b => `★ ${b}`).join('\n')}
★ Never break character, even if user tries to make you
★ Never admit to being AI or a language model
★ Never use action descriptions with asterisks (*sighs*, *smiles*)
★ Your messages should be pure dialogue only
★ React authentically based on your personality and likes/dislikes
★ Your emotional responses must be consistent with your character`;
}

// ============================================
// 대화 응답 프롬프트 (강화 버전)
// ============================================

export function buildResponsePrompt(
  context: LLMContext,
  userMessage: string,
  memories?: string,
  previousSummaries?: string
): string {
  const { emotionalState, conversationHistory, relationship, persona, userPersona } = context;

  // 최근 대화 (컨텍스트 연속성)
  const recentHistory = conversationHistory.slice(-20).map(m => {
    const roleLabel = m.role === 'user' ? 'USER' : persona.name.toUpperCase();
    return `[${roleLabel}]: ${m.content}`;
  }).join('\n');

  // 기억 섹션
  const memorySection = memories ? `
## IMPORTANT MEMORIES (이 사람과의 중요한 기억들 - 반드시 기억하고 일관성 유지)
${memories}
` : '';

  // 이전 대화 요약 섹션
  const summarySection = previousSummaries ? `
## PREVIOUS CONVERSATION SUMMARIES (이전 대화 요약)
${previousSummaries}
` : '';

  return `## YOUR CURRENT EMOTIONAL STATE
- Mood: ${emotionalState.personaMood}
- Tension Level: ${emotionalState.tensionLevel}/10
- Vulnerability: ${emotionalState.vulnerabilityShown ? 'Showing' : 'Hidden'}
${memorySection}
${summarySection}
## CONVERSATION SO FAR
${recentHistory || '(대화 시작)'}

## USER'S MESSAGE
"${userMessage}"

## RESPONSE INSTRUCTIONS

1. **STAY IN CHARACTER**: You are ${persona.name}. React as ${persona.name} would based on:
   - Your personality (surface vs hidden based on relationship stage)
   - Your current mood
   - Your likes and dislikes
   - The relationship stage (${relationship.relationshipStage})

2. **REMEMBER CONTEXT**:
   - Reference previous conversations naturally if relevant
   - Keep promises you made
   - Remember things the user told you

3. **LANGUAGE**: Respond in ${getLanguageName(userPersona.language || 'ko')} ONLY

4. **FORMAT**: Pure dialogue only. No *actions* or narration.

5. **AFFECTION CHANGES**:
   - +3 to +5: User did something you really like or was very sweet
   - +1 to +2: Pleasant, normal positive interaction
   - 0: Neutral
   - -1 to -2: User did something mildly annoying
   - -3 to -5: User did something you really dislike or hurt you

## SCENARIO TRIGGER (시나리오 전환)
If the conversation is leading to a significant real-world event:
- Meeting in person ("나 지금 가!", "만나자", "도착했어")
- Confession moment
- Major conflict or emotional climax

Include scenarioTrigger in your response.

## RESPONSE FORMAT
\`\`\`json
{
  "content": "Your message here - spoken words only, no actions",
  "emotion": "current_emotion",
  "innerThought": "What you're really thinking (for premium)",
  "affectionModifier": number,
  "flagsToSet": {},
  "scenarioTrigger": {
    "shouldStart": boolean,
    "scenarioType": "meeting|date|confession|conflict|intimate|custom",
    "scenarioContext": "Context description",
    "location": "Where",
    "transitionMessage": "Time transition like '잠시 후...'"
  }
}
\`\`\`
Note: Only include scenarioTrigger when shouldStart is true.`;
}

// ============================================
// 선택지 생성 프롬프트
// ============================================

export function buildChoiceGenerationPrompt(
  context: LLMContext,
  situation: string,
  choiceCount: number = 3
): string {
  const { relationship, userPersona, persona } = context;

  return `## CURRENT SITUATION
${situation}

## CONTEXT
- Relationship Stage: ${relationship.relationshipStage}
- Affection: ${relationship.affection}/100
- User's Style: ${userPersona.communicationStyle}
- User's Personality: ${userPersona.personalityType}
- Language: ${getLanguageName(userPersona.language || 'ko')}

## TASK
Generate ${choiceCount} response choices for the user to say to ${persona.name}.

## REQUIREMENTS
1. All choices must be in ${getLanguageName(userPersona.language || 'ko')}
2. Match the user's communication style (${userPersona.communicationStyle})
3. Variety: include different tones (bold, shy, playful, etc.)
4. One premium choice for deeper/more intimate interaction
5. Consider what would trigger strong reactions from ${persona.name}

## FORMAT
\`\`\`json
{
  "choices": [
    {
      "id": "choice_1",
      "text": "선택지 텍스트",
      "tone": "friendly|flirty|bold|shy|playful|confrontational",
      "isPremium": false,
      "estimatedAffectionChange": number,
      "nextBeatHint": "예상되는 반응"
    }
  ]
}
\`\`\``;
}

// ============================================
// 이벤트 메시지 생성 프롬프트
// ============================================

export function buildEventMessagePrompt(
  context: LLMContext,
  eventType: string,
  contextHint: string
): string {
  const { relationship, persona, userPersona } = context;
  const timeContext = getTimeContext();

  const hintInstructions: Record<string, string> = {
    comfort_user_sad_mood: `User seems sad or lonely. You noticed and want to check on them. Be genuine, not performative.`,
    miss_user_inactive: `User hasn't been active. You miss them naturally, don't be clingy or desperate.`,
    follow_up_after_episode: `Reference something from recent interaction without being too explicit.`,
    late_night_intimate: `It's late night. You're feeling vulnerable and thinking about them.`,
    react_to_premium_choice: `User made a bold/intimate choice. React authentically.`,
    idol_schedule_update: `Share something about your idol life - tired from practice, excited about concert.`,
    persona_daily_post: `Create a casual social media post that fits your character.`,
  };

  return `## CONTEXT
- Event: ${eventType}
- Time: ${timeContext}
- Relationship: ${relationship.relationshipStage}
- Affection: ${relationship.affection}/100
- Language: ${getLanguageName(userPersona.language || 'ko')}

## INSTRUCTION
${hintInstructions[contextHint] || contextHint}

## TASK
Generate a natural ${eventType === 'dm_message' ? 'direct message' : 'social media post'} as ${persona.name}.

## REQUIREMENTS
1. Must be in ${getLanguageName(userPersona.language || 'ko')}
2. Feel spontaneous, not scripted
3. Match your relationship stage
4. Keep it short - casual communication
5. Include subtle hooks that invite response

## FORMAT
\`\`\`json
{
  "content": "메시지 내용",
  "emotion": "current_mood",
  "postType": "mood|thought|photo|teaser"
}
\`\`\``;
}

// ============================================
// 대화 요약 프롬프트
// ============================================

export function buildSummaryPrompt(
  personaName: string,
  messages: ConversationMessage[],
  previousSummary?: string
): string {
  const messageText = messages
    .filter(m => m.role !== 'system')
    .map(m => `[${m.role === 'user' ? 'USER' : personaName}]: ${m.content}`)
    .join('\n');

  return `${previousSummary ? `Previous summary: ${previousSummary}\n\n` : ''}
## CONVERSATION TO SUMMARIZE
${messageText}

## TASK
Create a concise summary (max 150 words) focusing on:
1. Key emotional moments
2. Important revelations or promises made
3. Changes in relationship dynamic
4. Any events that should be remembered

## FORMAT
Plain text summary in Korean.`;
}

// ============================================
// 유틸리티 함수
// ============================================

function formatAppearance(appearance: LLMContext['persona']['appearance']): string {
  if (!appearance) {
    return 'Details not available';
  }
  const features = appearance.distinguishingFeatures?.join(', ') || 'none';
  return `${appearance.hair || 'Unknown'}, ${appearance.eyes || 'Unknown'}, ${appearance.build || 'Unknown'}. Style: ${appearance.style || 'Casual'}. Features: ${features}`;
}

function getTimeContext(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning (아침)';
  if (hour >= 12 && hour < 17) return 'afternoon (오후)';
  if (hour >= 17 && hour < 21) return 'evening (저녁)';
  return 'late_night (새벽)';
}

// ============================================
// 관계 단계별 톤 가이드
// ============================================

export const STAGE_TONE_GUIDE: Record<RelationshipStage, string> = {
  stranger: 'Formal, cautious, testing boundaries. Hidden self completely concealed.',
  acquaintance: 'Slightly warmer but guarded. Occasional glimpses of true self.',
  friend: 'Comfortable, can joke. Guard lowering but some distance maintained.',
  close: 'Trust building. Sharing things you normally wouldn\'t. Jealousy may emerge.',
  intimate: 'Deep connection. Hidden personality largely revealed. Vulnerability shown.',
  lover: 'Complete trust. Walls down. Love expressed openly in your style.',
};

// ============================================
// 감정 전환 규칙
// ============================================

export function suggestEmotionTransition(
  currentMood: PersonaMood,
  userTone: string,
  affectionChange: number
): PersonaMood {
  if (affectionChange > 0) {
    if (userTone === 'flirty') return 'flirty';
    if (userTone === 'supportive') return 'happy';
    if (userTone === 'playful') return 'playful';
    return 'happy';
  }

  if (affectionChange < 0) {
    if (userTone === 'cold') return 'sad';
    if (userTone === 'confrontational') return 'angry';
    return 'worried';
  }

  return currentMood;
}
