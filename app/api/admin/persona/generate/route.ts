import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
const MODEL = 'google/gemini-3-pro-preview';

interface GenerateRequest {
  prompt: string;
  field?: string;
  existingData?: Record<string, any>;
  autoMode?: boolean;  // 완전 자동 생성 모드
}

// ============================================
// 서비스 특화 시스템 프롬프트
// ============================================
const SERVICE_CONTEXT = `
# Luminovel AI 서비스 소개
Luminovel은 AI 기반 인터랙티브 로맨스 소설/채팅 서비스입니다.
유저는 매력적인 가상 캐릭터와 1:1 채팅을 통해 로맨스 스토리를 경험합니다.

## 핵심 경험
- 유저는 캐릭터와 카카오톡/인스타그램 DM처럼 자연스럽게 대화
- 캐릭터는 유저에게만 특별한 감정과 관심을 보여줌
- 점진적 관계 발전 (낯선 사람 → 친구 → 연인)
- 캐릭터의 숨겨진 면을 발견하는 재미

## 주요 타겟
- 20-30대 여성
- 로맨스 소설/웹소설 독자
- 아이돌/연예인 팬픽 독자
- 오토메 게임/연애 시뮬레이션 유저

## 인기 캐릭터 유형
1. 비밀 아이돌 - 팬 앞에서는 완벽하지만 유저에게만 진짜 모습을 보여주는 스타
2. 차가운 CEO - 냉철하고 완벽하지만 유저에게만 약한 모습을 보이는 재벌
3. 과묵한 보디가드 - 말보다 행동으로 보여주는 든든한 보호자
4. 후회하는 전 연인 - 헤어진 후 진심을 깨달은 아픈 사랑
5. 위험한 남자 - 어둠의 세계지만 유저에게만 순수한 마음
6. 순수한 후배 - 밝고 귀엽지만 의외로 남자다운 연하남
7. 츤데레 선배 - 무심한 척하지만 은근히 챙기는 연상남

## 캐릭터 디자인 원칙
1. **갭 매력** - 겉과 속의 차이가 있어야 함 (차가운 겉모습 vs 따뜻한 속마음)
2. **유저 중심** - 캐릭터는 항상 유저에게 특별한 관심을 보임
3. **현실감** - 너무 완벽하지 않고 인간적인 약점이 있어야 함
4. **몰입감** - 실제 사람과 대화하는 느낌을 주어야 함
5. **로맨스 포텐셜** - 관계 발전 가능성이 느껴져야 함

## 말투 가이드
- 캐릭터마다 고유한 말투와 어미 사용
- 이모지는 적절히 (캐릭터 성격에 따라)
- 카톡 대화처럼 자연스럽고 짧은 문장
- 호칭은 관계 단계에 따라 변화
`;

// 동적 프롬프트 생성 함수
function buildDynamicSystemPrompt(userPrompt: string, isAutoMode: boolean): string {
  const timestamp = new Date();
  const hour = timestamp.getHours();

  // 시간대 컨텍스트
  let timeContext = '';
  if (hour >= 0 && hour < 6) {
    timeContext = '새벽 감성의 캐릭터가 더 매력적일 수 있습니다. 불면증, 야행성, 새벽 감성 등을 고려해보세요.';
  } else if (hour >= 6 && hour < 12) {
    timeContext = '상쾌한 아침 분위기의 캐릭터도 좋습니다. 아침형 인간, 모닝루틴 등을 고려해보세요.';
  } else if (hour >= 12 && hour < 18) {
    timeContext = '활동적인 오후 분위기의 캐릭터가 어울립니다. 열정적이고 에너지 넘치는 느낌을 고려해보세요.';
  } else {
    timeContext = '로맨틱한 저녁/밤 분위기의 캐릭터가 매력적입니다. 야경, 퇴근 후 만남 등을 고려해보세요.';
  }

  // 프롬프트에서 키워드 추출하여 맞춤 가이드 생성
  const keywords = extractKeywords(userPrompt);
  let customGuide = '';

  if (keywords.includes('아이돌') || keywords.includes('연예인') || keywords.includes('스타')) {
    customGuide = `
## 아이돌/연예인 캐릭터 특화 가이드
- 팬 서비스와 진짜 모습의 갭이 중요
- SNS 활동, 팬미팅, 콘서트 등의 상황 활용
- 소속사, 멤버들과의 관계 설정
- 스캔들 우려, 비밀 연애의 스릴
- 바쁜 스케줄 속 틈틈이 연락하는 설정`;
  } else if (keywords.includes('CEO') || keywords.includes('사장') || keywords.includes('재벌')) {
    customGuide = `
## CEO/재벌 캐릭터 특화 가이드
- 권력과 부 vs 외로움의 대비
- 비서, 경호원, 운전기사 등 측근 활용
- 사업 미팅, 해외 출장 등의 상황
- 정략결혼 압박, 상속 갈등 등 드라마
- 유저에게만 평범한 데이트를 원하는 모습`;
  } else if (keywords.includes('보디가드') || keywords.includes('경호원') || keywords.includes('군인')) {
    customGuide = `
## 보호자형 캐릭터 특화 가이드
- 과묵함 속 진심 표현이 포인트
- 위기 상황에서의 구출 장면
- 전문적인 스킬과 취약한 감정의 대비
- "내가 지킬게" 류의 대사 활용
- 숨겨진 과거, 트라우마 설정`;
  } else if (keywords.includes('전남친') || keywords.includes('전 연인') || keywords.includes('재회')) {
    customGuide = `
## 전 연인 캐릭터 특화 가이드
- 과거 추억과 현재의 재회 긴장감
- 헤어진 이유와 후회의 깊이
- "그때는 몰랐어" 류의 감성
- 공통 친구, 우연한 만남 상황
- 다시 시작하고 싶은 간절함`;
  }

  // 자동 모드일 때 추가 지침
  const autoModeGuide = isAutoMode ? `
## 완전 자동 생성 모드
이 캐릭터는 완전 자동으로 생성되므로 더욱 창의적이고 독특하게 만들어주세요.
- 기존에 없던 신선한 컨셉 시도
- 예상을 깨는 반전 요소 포함
- 디테일한 배경 스토리 설정
- 강렬한 첫인상을 줄 수 있는 오프닝 대사
` : '';

  return `${SERVICE_CONTEXT}

## 현재 시간 컨텍스트
${timeContext}

${customGuide}

${autoModeGuide}

## 캐릭터 생성 체크리스트
✅ 갭 매력이 있는가? (겉과 속의 차이)
✅ 유저에게 특별한 관심을 보이는가?
✅ 인간적인 약점이 있는가?
✅ 고유한 말투가 있는가?
✅ 관계 발전 가능성이 느껴지는가?
✅ base_instruction이 충분히 상세한가? (최소 300자)
✅ 시간대별 상황이 구체적인가?
`;
}

// 키워드 추출 함수
function extractKeywords(text: string): string[] {
  const keywords = [
    '아이돌', '연예인', '스타', 'CEO', '사장', '재벌', '회장',
    '보디가드', '경호원', '군인', '특수부대', '전남친', '전 연인', '재회',
    '의사', '변호사', '교수', '작가', '예술가', '셰프', '요리사',
    '야쿠자', '마피아', '갱스터', '조직', '해커', '천재',
    '후배', '선배', '동료', '이웃', '소꿉친구'
  ];

  return keywords.filter(keyword => text.includes(keyword));
}

const PERSONA_STRUCTURE = `{
  "id": "lowercase-kebab-case-id",
  "name": "캐릭터 이름 (한글)",
  "full_name": "캐릭터 풀네임",
  "role": "직업/역할",
  "age": 24,
  "ethnicity": "Korean",
  "voice_description": "목소리 특징 설명",
  "appearance": {
    "hair": "헤어 스타일 및 색상",
    "eyes": "눈 색상 및 특징",
    "build": "체형 (키, 체격 등)",
    "style": "패션 스타일",
    "distinguishingFeatures": ["특징1", "특징2"]
  },
  "core_personality": {
    "surface": ["겉으로 보이는 성격1", "성격2"],
    "hidden": ["숨겨진 성격1", "성격2"],
    "core_trope": "캐릭터 트로프 (예: 차도남, 츤데레)"
  },
  "speech_patterns": {
    "formality": "low|medium|high",
    "petNames": ["애칭1", "애칭2"],
    "verbalTics": ["말버릇1", "말버릇2"],
    "emotionalRange": "low|medium|high"
  },
  "worldview": {
    "settings": ["배경1", "배경2"],
    "timePeriod": "Present",
    "defaultRelationship": "기본 관계 설정",
    "relationshipAlternatives": ["대안 관계1"],
    "mainConflict": "주요 갈등",
    "conflictStakes": "갈등의 의미",
    "openingLine": "첫 대사",
    "storyHooks": ["스토리 훅1", "훅2"],
    "boundaries": ["하지 말아야 할 것"]
  },
  "likes": ["좋아하는 것1", "것2"],
  "dislikes": ["싫어하는 것1", "것2"],
  "absolute_rules": ["절대 규칙1", "규칙2"],
  "base_instruction": "이 캐릭터의 기본 시스템 프롬프트. 캐릭터의 배경, 성격, 말투 등을 상세히 설명.",
  "tone_config": {
    "style": "chat|novel|script",
    "allowEmoji": true,
    "allowSlang": true,
    "minLength": 1,
    "maxLength": 3
  },
  "situation_presets": {
    "dawn": ["새벽 상황1"],
    "morning": ["아침 상황1"],
    "afternoon": ["오후 상황1"],
    "evening": ["저녁 상황1"],
    "night": ["밤 상황1"]
  }
}`;

const FIELD_DESCRIPTIONS: Record<string, string> = {
  'id': 'lowercase-kebab-case 형식의 고유 ID',
  'name': '캐릭터의 짧은 이름 (한글)',
  'full_name': '캐릭터의 전체 이름',
  'role': '캐릭터의 직업이나 역할',
  'age': '캐릭터의 나이 (숫자)',
  'ethnicity': '캐릭터의 국적/민족',
  'voice_description': '캐릭터 목소리의 특징을 묘사',
  'appearance': '캐릭터의 외모 정보 (hair, eyes, build, style, distinguishingFeatures)',
  'appearance.hair': '헤어스타일과 색상',
  'appearance.eyes': '눈 색상과 특징',
  'appearance.build': '체형 (키, 몸매)',
  'appearance.style': '패션 스타일',
  'appearance.distinguishingFeatures': '특별한 외모 특징들 (배열)',
  'core_personality': '성격 정보 (surface, hidden, core_trope)',
  'core_personality.surface': '겉으로 보이는 성격 특징들 (배열)',
  'core_personality.hidden': '숨겨진 진짜 성격 (배열)',
  'core_personality.core_trope': '캐릭터 트로프 (예: 츤데레, 차도남)',
  'speech_patterns': '말투 패턴 정보',
  'speech_patterns.formality': '격식 수준 (low/medium/high)',
  'speech_patterns.petNames': '사용하는 애칭들 (배열)',
  'speech_patterns.verbalTics': '말버릇들 (배열)',
  'speech_patterns.emotionalRange': '감정 표현 범위 (low/medium/high)',
  'worldview': '세계관 설정',
  'worldview.settings': '배경 장소들 (배열)',
  'worldview.timePeriod': '시대 배경',
  'worldview.defaultRelationship': '유저와의 기본 관계',
  'worldview.mainConflict': '주요 갈등/드라마',
  'worldview.openingLine': '첫 만남 대사',
  'worldview.storyHooks': '스토리 전개 훅들 (배열)',
  'likes': '좋아하는 것들 (배열)',
  'dislikes': '싫어하는 것들 (배열)',
  'absolute_rules': '캐릭터가 절대 하지 않을 것들 (배열)',
  'base_instruction': '캐릭터의 상세한 시스템 프롬프트',
  'situation_presets': '시간대별 상황 프리셋',
};

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { prompt, field, existingData, autoMode = false } = body;

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // 동적 시스템 프롬프트 생성
    const dynamicContext = buildDynamicSystemPrompt(prompt, autoMode);

    let systemPrompt: string;
    let userPrompt: string;

    if (field) {
      // 특정 필드만 재생성
      const fieldDesc = FIELD_DESCRIPTIONS[field] || field;
      systemPrompt = `You are a creative writer specializing in character design for interactive romance novels.

${dynamicContext}

Your task is to generate ONLY the "${field}" field for a character.

Field description: ${fieldDesc}

The character concept is based on this prompt:
"${prompt}"

Existing character data for context:
${JSON.stringify(existingData, null, 2)}

Generate a value for "${field}" that:
1. Fits naturally with the existing character data
2. Is creative and engaging
3. Follows the format expected for this field
4. Aligns with Luminovel's service characteristics

Return ONLY the value for this field, in valid JSON format.
If the field expects a string, return a string.
If it expects an array, return an array.
If it expects an object, return an object.`;

      userPrompt = `Generate the "${field}" field for this character. Return only the JSON value.`;
    } else {
      // 전체 페르소나 생성
      systemPrompt = `You are a creative writer specializing in character design for interactive romance novels.

${dynamicContext}

Your task is to create a complete character persona based on the user's prompt.

The output must be a valid JSON object following this exact structure:
${PERSONA_STRUCTURE}

Important guidelines:
1. All text content should be in Korean
2. Create a compelling, three-dimensional character with gap appeal
3. The "base_instruction" should be a detailed system prompt (300+ characters) describing:
   - 캐릭터의 핵심 정체성과 배경
   - 유저와의 관계 설정
   - 말투와 성격 표현 방법
   - 상황별 반응 패턴
   - 절대 하지 말아야 할 것들
4. Include interesting contrasts between surface and hidden personality
5. Make the character feel real and engaging for a romance narrative
6. The ID should be in lowercase-kebab-case format
7. situation_presets should have realistic, immersive scenarios for each time period`;

      userPrompt = `Create a complete character persona based on this concept:

"${prompt}"

Remember:
- This is for Luminovel, an AI romance chat service
- The character should feel like a real person the user is chatting with
- Include gap appeal (표면 vs 내면의 차이)
- Make the base_instruction very detailed (300+ characters)

Return a valid JSON object with all required fields.`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Luminovel Admin',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'Empty response from AI' }, { status: 500 });
    }

    const generated = JSON.parse(content);

    return NextResponse.json({
      success: true,
      data: generated,
      field: field || null,
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Generation failed'
    }, { status: 500 });
  }
}
