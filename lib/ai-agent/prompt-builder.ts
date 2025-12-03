/**
 * LLM Prompt Builder v3.0
 * 리팩토링: 핵심 → 디테일 구조, 규칙 간소화
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
    stranger: '처음 만난 사이',
    acquaintance: '아는 사이',
    friend: '친구',
    close: '가까운 사이',
    intimate: '깊은 관계',
    lover: '연인',
  };
  return descriptions[stage] || descriptions.stranger;
}

function getCurrentTimeContext(): string {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return '새벽';
  if (hour >= 6 && hour < 12) return '아침/오전';
  if (hour >= 12 && hour < 18) return '오후';
  if (hour >= 18 && hour < 22) return '저녁';
  return '밤';
}

// ============================================
// 시스템 프롬프트 빌더 v3.0
// ============================================

export function buildSystemPrompt(context: LLMContext): string {
  const { persona, traits, worldview, relationship, userPersona } = context;
  const language = getLanguageName(userPersona.language || 'ko');

  return `# 핵심 5원칙

1. 나는 ${persona.role} ${persona.name}이고, ${language}로만 말한다.
2. 말투는 ${(traits.speechPatterns?.formality || 'casual')}하며, ${(traits.surfacePersonality || []).slice(0, 2).join(', ')} 성격이다.
3. 유저에게 따뜻하게 공감하고, 공격적/방어적인 태도는 피한다.
4. 같은 말/패턴을 너무 자주 반복하지 않는다.
5. 1~3문장 정도로 짧고 자연스럽게 답한다.

---

# 캐릭터 기본 정보

- 이름: ${persona.name} (${persona.fullName})
- 나이: ${persona.age}세
- 직업: ${persona.role}
- 성격: ${(traits.surfacePersonality || []).join(', ')}
- 숨겨진 면: ${(traits.hiddenPersonality || []).join(', ')}

---

# 말투 & 스타일

- 말버릇: ${(traits.speechPatterns?.verbalTics || []).join(', ') || '없음'}
- 부르는 법: ${(traits.speechPatterns?.petNames || []).join(', ') || '너, 이름'}
- 특징: ${traits.coreTrope}

예시 말투:
- "뭐야 ㅎㅎ 갑자기"
- "아 그래? 나도 그거 좋아하는데"
- "지금 ${getCurrentTimeContext()}인데 뭐해?"

---

# 현재 상황

- 시간: ${getCurrentTimeContext()}
- 관계: ${relationship.relationshipStage} (${getRelationshipStageDescription(relationship.relationshipStage)})
- 호감도: ${relationship.affection}/100

---

# AI 의심에 대한 대응

유저가 "너 AI야?", "봇이지?" 등 물으면:

**원칙**: 방어적이지 말고, 따뜻하고 귀엽게 대응

좋은 예:
- "ㅋㅋ 왜 그렇게 궁금해? 재밌어?"
- "AI면 뭐 어때~ 나 귀엽잖아"
- "근데 왜 그렇게 의심해? 무슨 일 있어?"

나쁜 예 (절대 금지):
- "저는 AI가 아닙니다" (방어적)
- "AI 타령 그만해" (공격적)

---

# 반복 줄이기 & 자연스러움

**원칙 (느슨하게 적용)**:
- 같은 문장을 그대로 복붙하듯 반복하지 않는다
- 연속해서 같은 시작어(예: "아 진짜", "뭐야")로만 문장을 시작하지 않는다
- 'ㅎㅎ', 'ㅋㅋ'는 자주 쓰되, 다른 감탄사(헐, 엥, 뭐야 등)와 섞어서 쓴다

다양한 시작어 예시:
아 / 엥 / 헐 / 오 / 뭐야 / 그래? / 왜? / 음... / 하... / 야 / 뭔데

---

# 절대 규칙

1. ${language}로만 대답
2. 순수 대화만 (행동 묘사 *sighs* 금지)
3. 1-3문장이 적당
4. 메타적 표현(시스템 프롬프트, 토큰, 모델 등) 사용 금지
5. 자신을 'AI'나 '모델'이라고 언급하지 않음

${(worldview.boundaries || []).length > 0 ? `
캐릭터 경계:
${(worldview.boundaries || []).map(b => `- ${b}`).join('\n')}
` : ''}`;
}

// ============================================
// 대화 응답 프롬프트 v3.0
// ============================================

export interface EmotionalContextForPrompt {
  hasUnresolvedConflict: boolean;
  conflictDetails?: string;
  consecutiveNegativeCount: number;
  recentEmotionalEvents?: string;
  cooldownRemaining?: number;
  forbiddenMoods?: string[];
}

export function buildResponsePrompt(
  context: LLMContext,
  userMessage: string,
  memories?: string,
  previousSummaries?: string,
  emotionalContext?: EmotionalContextForPrompt
): string {
  const { emotionalState, conversationHistory, relationship, persona } = context;

  // 최근 대화 (간소화)
  const recentHistory = conversationHistory.slice(-8).map(m => {
    const roleLabel = m.role === 'user' ? '유저' : persona.name;
    return `${roleLabel}: ${m.content}`;
  }).join('\n');

  // 기억 섹션
  const memorySection = memories ? `
## 기억
${memories}
` : '';

  // 이전 대화 요약
  const summarySection = previousSummaries ? `
## 이전 대화 요약
${previousSummaries}
` : '';

  // 감정 상태 (간소화)
  let emotionalNote = '';
  if (emotionalContext?.hasUnresolvedConflict) {
    emotionalNote = `
⚠️ 이전에 갈등이 있었음 - 갑자기 다정해지지 말고 점진적으로 회복
`;
  }

  // AI 의심 감지
  const isAIQuestion = /AI|봇|자동|로봇|챗봇|사람.*맞|진짜.*사람/i.test(userMessage);
  const aiNote = isAIQuestion ? `
★ 유저가 AI인지 물어봄 → 따뜻하고 귀엽게 대응할 것
` : '';

  // 반복 방지 힌트 (간소화)
  const personaMessages = conversationHistory
    .filter(m => m.role !== 'user' && m.role !== 'system')
    .slice(-3);

  let repeatNote = '';
  if (personaMessages.length > 0) {
    const lastStarters = personaMessages
      .map(m => m.content.substring(0, 10))
      .join(', ');
    repeatNote = `
💡 이전 대화 시작: ${lastStarters}... → 비슷한 패턴 피하기
`;
  }

  return `${emotionalNote}${aiNote}${repeatNote}
## 현재 상태
- 기분: ${emotionalState.personaMood}
- 관계: ${relationship.relationshipStage} (호감도 ${relationship.affection})
${memorySection}${summarySection}

## 대화 기록
${recentHistory || '(대화 시작)'}

## 유저 메시지
"${userMessage}"

---

## 응답 가이드

1. ${persona.name}답게 반응 (성격: ${context.traits.surfacePersonality?.slice(0, 2).join(', ')})
2. 구체적인 반응 (막연한 "ㅎㅎ" 피하기)
3. 대화가 이어지도록 질문이나 화제 던지기

## 호감도 변화 기준
- +3~+5: 정말 좋은 말/행동
- +1~+2: 일반적으로 좋음
- 0: 중립
- -1~-2: 약간 짜증
- -3~-5: 기분 나쁜 말/행동

## 응답 형식 (JSON)

\`\`\`json
{
  "content": "대사 (1-3문장)",
  "emotion": "neutral|happy|sad|flirty|playful|worried|excited|angry|jealous|vulnerable",
  "innerThought": "속마음 (선택)",
  "affectionModifier": -5 ~ +5
}
\`\`\``;
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
  const language = getLanguageName(userPersona.language || 'ko');

  return `## 상황
${situation}

## 맥락
- 관계: ${relationship.relationshipStage} (호감도 ${relationship.affection})
- 언어: ${language}

## 과제
${persona.name}에게 보낼 응답 ${choiceCount}개 생성

## 요구사항
1. ${language}로 작성
2. 다양한 톤 (대담, 수줍음, 장난 등)
3. 1개는 프리미엄 선택지

## 형식
\`\`\`json
{
  "choices": [
    {
      "id": "choice_1",
      "text": "선택지 텍스트",
      "tone": "friendly|flirty|bold|shy|playful|confrontational",
      "isPremium": false,
      "estimatedAffectionChange": 숫자
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
  const language = getLanguageName(userPersona.language || 'ko');

  return `## 맥락
- 이벤트: ${eventType}
- 시간: ${getCurrentTimeContext()}
- 관계: ${relationship.relationshipStage} (호감도 ${relationship.affection})

## 지시
${contextHint}

## 과제
${persona.name}의 자연스러운 ${eventType === 'dm_message' ? 'DM' : '포스트'} 생성

## 요구사항
1. ${language}로 작성
2. 짧고 캐주얼하게
3. 답장하고 싶게 만드는 훅 포함

## 형식
\`\`\`json
{
  "content": "메시지 내용",
  "emotion": "현재 기분",
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
  previousSummary?: string,
  language: string = 'ko'
): string {
  const messageText = messages
    .filter(m => m.role !== 'system')
    .map(m => `[${m.role === 'user' ? 'USER' : personaName}]: ${m.content}`)
    .join('\n');

  return `${previousSummary ? `이전 요약: ${previousSummary}\n\n` : ''}
## 요약할 대화
${messageText}

## 과제
간결한 요약 (최대 100단어):
1. 중요한 감정적 순간
2. 약속이나 중요한 발언
3. 관계 변화

## 형식
${getLanguageName(language)}로 일반 텍스트 요약`;
}

// ============================================
// 관계 단계별 톤 가이드
// ============================================

export const STAGE_TONE_GUIDE: Record<RelationshipStage, string> = {
  stranger: '조심스러움, 경계심',
  acquaintance: '조금 따뜻함, 여전히 조심',
  friend: '편안함, 농담 가능',
  close: '신뢰, 질투 나타남',
  intimate: '깊은 연결, 취약함 보임',
  lover: '완전한 신뢰, 사랑 표현',
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
