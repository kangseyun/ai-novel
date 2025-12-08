/**
 * Scenario Generator Service
 * AI를 활용한 시나리오 자동 생성 서비스
 *
 * 기능:
 * 1. Static 시나리오 초벌 생성 (관리자가 수정 가능)
 * 2. Guided 시나리오 플롯 포인트 생성
 * 3. Dynamic 시나리오 실시간 생성
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { LLMClient, LLMCallOptions } from '../core/llm-client';

// ============================================
// 타입 정의
// ============================================

export interface PersonaContext {
  id: string;
  name: string;
  personality: Record<string, unknown>;
  worldview?: Record<string, unknown>;
  speechStyle?: Record<string, unknown>;
  currentMood?: string;
}

export interface ScenarioGenerationRequest {
  personaId: string;
  scenarioType: 'static' | 'guided' | 'dynamic';

  // 생성 힌트
  theme?: string;           // 예: "첫 만남", "갈등", "화해", "고백"
  targetEmotion?: string;   // 예: "설렘", "슬픔", "행복"
  situationHint?: string;   // 예: "비 오는 날 우연히 만남"

  // 조건 설정
  minAffection?: number;
  maxAffection?: number;
  relationshipStage?: string;

  // 분기/선택지 설정
  sceneCount?: number;      // 생성할 씬 개수 (기본: 3-5)
  choicesPerScene?: number; // 씬당 선택지 개수 (기본: 2-3)
  includePremiumChoice?: boolean; // 프리미엄 선택지 포함 여부

  // 컨텍스트
  userContext?: {
    affection: number;
    relationshipStage: string;
    recentTopics?: string[];
  };
}

export interface GeneratedScene {
  id: string;
  sceneNumber: number;
  sceneType: 'dialogue' | 'narration' | 'choice' | 'transition';
  content: {
    text: string;
    speaker?: 'persona' | 'narration' | 'user';
    emotion?: string;
    backgroundHint?: string;
  };
  choices?: GeneratedChoice[];
  nextSceneId?: string;
  conditionalNext?: {
    condition: string;
    sceneId: string;
  }[];
}

export interface GeneratedChoice {
  id: string;
  text: string;
  tone: 'friendly' | 'romantic' | 'neutral' | 'playful' | 'serious';
  isPremium: boolean;
  affectionChange: number;
  nextSceneId: string;
  responseHint?: string;  // AI 응답 생성용 힌트
}

export interface GeneratedScenario {
  id: string;
  title: string;
  description: string;
  personaId: string;
  generationMode: 'static' | 'guided' | 'dynamic';
  triggerConditions: {
    minAffection?: number;
    maxAffection?: number;
    relationshipStage?: string;
    keywords?: string[];
  };
  scenes: GeneratedScene[];
  metadata: {
    theme: string;
    estimatedDuration: string;
    emotionalArc: string[];
    generatedAt: string;
    modelUsed?: string;
  };
}

export interface GuidedPlotPoint {
  id: string;
  plotPointNumber: number;
  plotType: 'opening' | 'rising_action' | 'climax' | 'falling_action' | 'resolution';
  description: string;
  emotionalBeat: string;
  speakerGuidance: string;
  userChoiceGuidance?: string;
  transitionHint?: string;
}

export interface DynamicScenarioTemplate {
  id: string;
  name: string;
  description: string;
  personaId: string;
  triggerConditions: Record<string, unknown>;
  generationPrompt: string;
  constraintRules: {
    blockedTopics: string[];
    requiredElements: string[];
    maxTurns: number;
    emotionalGuardrails: string[];
  };
  fallbackResponses: string[];
}

// ============================================
// 프롬프트 템플릿
// ============================================

const SCENARIO_GENERATION_SYSTEM_PROMPT = `You are an expert interactive fiction writer specializing in emotionally engaging character-driven scenarios.

Your task is to generate a scenario for a virtual character interaction app. The scenarios should:
1. Be emotionally engaging and feel natural
2. Allow for meaningful user choices that affect the story
3. Stay true to the character's personality and worldview
4. Create moments of connection between the user and character
5. Include appropriate emotional arcs

Output format: JSON with the exact structure specified in the user prompt.
All text content should be in Korean (한국어).`;

const STATIC_SCENARIO_PROMPT_TEMPLATE = `Generate a complete interactive scenario for the following character:

# Character Information
Name: {{personaName}}
Personality: {{personality}}
Worldview: {{worldview}}
Speech Style: {{speechStyle}}

# Scenario Requirements
Theme: {{theme}}
Target Emotion: {{targetEmotion}}
Situation: {{situationHint}}
Number of Scenes: {{sceneCount}}
Choices per Scene: {{choicesPerScene}}
Include Premium Choices: {{includePremiumChoice}}

# Relationship Context
Minimum Affection: {{minAffection}}
Relationship Stage: {{relationshipStage}}

# Output Format
Generate a JSON object with this structure:
{
  "title": "시나리오 제목",
  "description": "간단한 설명 (1-2문장)",
  "scenes": [
    {
      "id": "scene_1",
      "sceneNumber": 1,
      "sceneType": "dialogue|narration|choice|transition",
      "content": {
        "text": "대사 또는 나레이션 텍스트",
        "speaker": "persona|narration|user",
        "emotion": "감정 상태",
        "backgroundHint": "배경 힌트"
      },
      "choices": [
        {
          "id": "choice_1_1",
          "text": "선택지 텍스트",
          "tone": "friendly|romantic|neutral|playful|serious",
          "isPremium": false,
          "affectionChange": 5,
          "nextSceneId": "scene_2",
          "responseHint": "이 선택에 대한 캐릭터 반응 힌트"
        }
      ],
      "nextSceneId": "scene_2"
    }
  ],
  "metadata": {
    "theme": "{{theme}}",
    "estimatedDuration": "3-5분",
    "emotionalArc": ["설렘", "긴장", "해소"]
  }
}

Important:
- Each scene should flow naturally to the next
- Choices should have meaningful consequences
- Premium choices should offer deeper emotional connection
- The character's voice should be consistent throughout
- End with a satisfying emotional resolution or cliffhanger`;

const GUIDED_PLOT_PROMPT_TEMPLATE = `Generate plot points for a guided scenario where AI will generate the actual dialogue.

# Character Information
Name: {{personaName}}
Personality: {{personality}}

# Scenario Requirements
Theme: {{theme}}
Target Emotion: {{targetEmotion}}
Number of Plot Points: {{plotPointCount}}

# Output Format
Generate a JSON array of plot points:
{
  "plotPoints": [
    {
      "id": "plot_1",
      "plotPointNumber": 1,
      "plotType": "opening|rising_action|climax|falling_action|resolution",
      "description": "이 플롯 포인트에서 일어나는 일",
      "emotionalBeat": "이 시점의 감정 톤",
      "speakerGuidance": "캐릭터가 어떤 식으로 말해야 하는지",
      "userChoiceGuidance": "유저에게 어떤 선택을 제공할지",
      "transitionHint": "다음 플롯으로 어떻게 연결할지"
    }
  ]
}`;

const DYNAMIC_SCENARIO_PROMPT_TEMPLATE = `Generate a real-time scenario response based on the current context.

# Character
Name: {{personaName}}
Personality: {{personality}}
Current Mood: {{currentMood}}

# Current Context
User Affection: {{affection}}
Relationship Stage: {{relationshipStage}}
Recent Topics: {{recentTopics}}
Trigger Reason: {{triggerReason}}

# Constraints
Blocked Topics: {{blockedTopics}}
Required Elements: {{requiredElements}}
Max Turns Remaining: {{maxTurns}}

# Task
Generate the next part of an ongoing scenario. Output JSON:
{
  "scenarioText": "캐릭터의 대사 또는 행동",
  "emotion": "현재 감정",
  "suggestedChoices": [
    {
      "text": "선택지",
      "tone": "friendly|romantic|neutral",
      "expectedResponse": "이 선택에 대한 예상 반응"
    }
  ],
  "shouldContinue": true,
  "nextPromptHint": "다음 턴에 고려할 컨텍스트"
}`;

// ============================================
// 서비스 구현
// ============================================

export class ScenarioGeneratorService {
  private supabase: SupabaseClient;
  private llmClient: LLMClient;

  constructor(supabase: SupabaseClient, llmClient?: LLMClient) {
    this.supabase = supabase;
    this.llmClient = llmClient || new LLMClient();
  }

  /**
   * 페르소나 컨텍스트 로드
   */
  private async loadPersonaContext(personaId: string): Promise<PersonaContext | null> {
    const { data: persona, error } = await this.supabase
      .from('persona_core')
      .select(`
        id,
        name,
        persona_personalities (personality),
        persona_worldviews (worldview),
        persona_speech_styles (speech_style)
      `)
      .eq('id', personaId)
      .single();

    if (error || !persona) {
      console.error('Failed to load persona:', error);
      return null;
    }

    return {
      id: persona.id,
      name: persona.name,
      personality: (persona.persona_personalities as { personality: Record<string, unknown> }[])?.[0]?.personality || {},
      worldview: (persona.persona_worldviews as { worldview: Record<string, unknown> }[])?.[0]?.worldview || {},
      speechStyle: (persona.persona_speech_styles as { speech_style: Record<string, unknown> }[])?.[0]?.speech_style || {},
    };
  }

  /**
   * 템플릿 변수 치환
   */
  private fillTemplate(template: string, variables: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const stringValue = typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value ?? '');
      result = result.replace(new RegExp(placeholder, 'g'), stringValue);
    }
    return result;
  }

  /**
   * Static 시나리오 생성 (완전한 시나리오 구조)
   */
  async generateStaticScenario(
    request: ScenarioGenerationRequest
  ): Promise<GeneratedScenario | null> {
    const persona = await this.loadPersonaContext(request.personaId);
    if (!persona) {
      throw new Error(`Persona not found: ${request.personaId}`);
    }

    const prompt = this.fillTemplate(STATIC_SCENARIO_PROMPT_TEMPLATE, {
      personaName: persona.name,
      personality: persona.personality,
      worldview: persona.worldview,
      speechStyle: persona.speechStyle,
      theme: request.theme || '일상적인 대화',
      targetEmotion: request.targetEmotion || '따뜻함',
      situationHint: request.situationHint || '평범한 하루',
      sceneCount: request.sceneCount || 4,
      choicesPerScene: request.choicesPerScene || 2,
      includePremiumChoice: request.includePremiumChoice ?? true,
      minAffection: request.minAffection || 0,
      relationshipStage: request.relationshipStage || 'acquaintance',
    });

    try {
      const response = await this.callLLMForScenario(prompt, {
        taskContext: {
          type: 'scenario_generation',
          requiresCreativity: true,
          requiresConsistency: true,
        },
      });

      const parsed = JSON.parse(response);

      // 생성 로그 저장
      await this.logGeneration({
        personaId: request.personaId,
        scenarioType: 'static',
        request,
        success: true,
      });

      return {
        id: `scenario_${Date.now()}`,
        title: parsed.title,
        description: parsed.description,
        personaId: request.personaId,
        generationMode: 'static',
        triggerConditions: {
          minAffection: request.minAffection,
          maxAffection: request.maxAffection,
          relationshipStage: request.relationshipStage,
        },
        scenes: parsed.scenes,
        metadata: {
          ...parsed.metadata,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Failed to generate static scenario:', error);

      await this.logGeneration({
        personaId: request.personaId,
        scenarioType: 'static',
        request,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return null;
    }
  }

  /**
   * Guided 시나리오 플롯 포인트 생성
   */
  async generateGuidedPlotPoints(
    request: ScenarioGenerationRequest,
    plotPointCount: number = 5
  ): Promise<GuidedPlotPoint[] | null> {
    const persona = await this.loadPersonaContext(request.personaId);
    if (!persona) {
      throw new Error(`Persona not found: ${request.personaId}`);
    }

    const prompt = this.fillTemplate(GUIDED_PLOT_PROMPT_TEMPLATE, {
      personaName: persona.name,
      personality: persona.personality,
      theme: request.theme || '일상적인 대화',
      targetEmotion: request.targetEmotion || '따뜻함',
      plotPointCount,
    });

    try {
      const response = await this.callLLMForScenario(prompt, {
        taskContext: {
          type: 'scenario_generation',
          requiresCreativity: true,
        },
      });

      const parsed = JSON.parse(response);

      await this.logGeneration({
        personaId: request.personaId,
        scenarioType: 'guided',
        request,
        success: true,
      });

      return parsed.plotPoints;
    } catch (error) {
      console.error('Failed to generate guided plot points:', error);

      await this.logGeneration({
        personaId: request.personaId,
        scenarioType: 'guided',
        request,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return null;
    }
  }

  /**
   * Dynamic 시나리오 실시간 응답 생성
   */
  async generateDynamicResponse(
    template: DynamicScenarioTemplate,
    userContext: {
      affection: number;
      relationshipStage: string;
      recentTopics?: string[];
      currentTurn: number;
    },
    triggerReason: string
  ): Promise<{
    scenarioText: string;
    emotion: string;
    suggestedChoices: { text: string; tone: string; expectedResponse: string }[];
    shouldContinue: boolean;
    nextPromptHint: string;
  } | null> {
    const persona = await this.loadPersonaContext(template.personaId);
    if (!persona) {
      throw new Error(`Persona not found: ${template.personaId}`);
    }

    const prompt = this.fillTemplate(DYNAMIC_SCENARIO_PROMPT_TEMPLATE, {
      personaName: persona.name,
      personality: persona.personality,
      currentMood: persona.currentMood || 'neutral',
      affection: userContext.affection,
      relationshipStage: userContext.relationshipStage,
      recentTopics: userContext.recentTopics?.join(', ') || 'none',
      triggerReason,
      blockedTopics: template.constraintRules.blockedTopics.join(', '),
      requiredElements: template.constraintRules.requiredElements.join(', '),
      maxTurns: template.constraintRules.maxTurns - userContext.currentTurn,
    });

    try {
      const response = await this.callLLMForScenario(prompt, {
        taskContext: {
          type: 'scenario_generation',
          requiresCreativity: true,
          requiresConsistency: true,
        },
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to generate dynamic response:', error);

      // 폴백 응답 반환
      const fallback = template.fallbackResponses[
        Math.floor(Math.random() * template.fallbackResponses.length)
      ];

      return {
        scenarioText: fallback || '...',
        emotion: 'neutral',
        suggestedChoices: [],
        shouldContinue: false,
        nextPromptHint: '',
      };
    }
  }

  /**
   * 생성된 시나리오를 DB에 저장
   */
  async saveGeneratedScenario(
    scenario: GeneratedScenario,
    saveToDraft: boolean = true
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('scenario_templates')
        .insert({
          id: scenario.id,
          persona_id: scenario.personaId,
          title: scenario.title,
          description: scenario.description,
          scenario_type: 'story_episode',
          generation_mode: scenario.generationMode,
          trigger_conditions: scenario.triggerConditions,
          content: {
            scenes: scenario.scenes,
          },
          min_affection: scenario.triggerConditions.minAffection || 0,
          min_relationship_stage: scenario.triggerConditions.relationshipStage || 'stranger',
          is_active: !saveToDraft, // 드래프트면 비활성
          metadata: scenario.metadata,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Failed to save scenario:', error);
      return null;
    }
  }

  /**
   * Guided 플롯 포인트를 DB에 저장
   */
  async saveGuidedPlotPoints(
    scenarioId: string,
    plotPoints: GuidedPlotPoint[]
  ): Promise<boolean> {
    try {
      const insertData = plotPoints.map(pp => ({
        scenario_id: scenarioId,
        plot_point_number: pp.plotPointNumber,
        plot_type: pp.plotType,
        description: pp.description,
        emotional_beat: pp.emotionalBeat,
        speaker_guidance: pp.speakerGuidance,
        user_choice_guidance: pp.userChoiceGuidance,
        transition_hint: pp.transitionHint,
      }));

      const { error } = await this.supabase
        .from('guided_scenario_plots')
        .insert(insertData);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to save plot points:', error);
      return false;
    }
  }

  /**
   * Dynamic 템플릿을 DB에 저장
   */
  async saveDynamicTemplate(
    template: DynamicScenarioTemplate
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('dynamic_scenario_templates')
        .insert({
          id: template.id,
          name: template.name,
          description: template.description,
          persona_id: template.personaId,
          trigger_conditions: template.triggerConditions,
          generation_prompt: template.generationPrompt,
          blocked_topics: template.constraintRules.blockedTopics,
          required_elements: template.constraintRules.requiredElements,
          max_turns: template.constraintRules.maxTurns,
          emotional_guardrails: template.constraintRules.emotionalGuardrails,
          fallback_responses: template.fallbackResponses,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Failed to save dynamic template:', error);
      return null;
    }
  }

  /**
   * LLM 호출 (시나리오 생성용)
   */
  private async callLLMForScenario(
    userPrompt: string,
    options?: LLMCallOptions
  ): Promise<string> {
    // LLMClient의 raw call 메서드 사용
    const messages = [
      { role: 'system' as const, content: SCENARIO_GENERATION_SYSTEM_PROMPT },
      { role: 'user' as const, content: userPrompt },
    ];

    // LLMClient 내부 메서드 호출을 위한 래핑
    const response = await (this.llmClient as unknown as {
      callLLM: (
        messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
        options?: LLMCallOptions
      ) => Promise<{ content: string; model: string; usage?: { totalTokens: number } }>;
    }).callLLM(messages, {
      ...options,
      temperature: 0.8, // 창의성을 위해 높은 온도
      maxTokens: 4000,  // 시나리오 생성을 위한 충분한 토큰
    });

    return response.content;
  }

  /**
   * 생성 로그 저장
   */
  private async logGeneration(data: {
    personaId: string;
    scenarioType: string;
    request: ScenarioGenerationRequest;
    success: boolean;
    error?: string;
  }): Promise<void> {
    try {
      await this.supabase.from('scenario_generation_logs').insert({
        persona_id: data.personaId,
        generation_type: data.scenarioType,
        input_params: data.request,
        success: data.success,
        error_message: data.error,
      });
    } catch (error) {
      console.error('Failed to log generation:', error);
    }
  }

  /**
   * 테마별 시나리오 템플릿 제안
   */
  getThemeSuggestions(relationshipStage: string): { theme: string; description: string }[] {
    const suggestions: Record<string, { theme: string; description: string }[]> = {
      stranger: [
        { theme: '우연한 만남', description: '예상치 못한 장소에서의 첫 만남' },
        { theme: '도움 요청', description: '작은 도움이 인연의 시작이 되는' },
        { theme: '오해와 화해', description: '처음엔 오해했지만 풀리는 과정' },
      ],
      acquaintance: [
        { theme: '공통 관심사', description: '같은 취미나 관심사를 발견하는' },
        { theme: '우연의 일치', description: '자꾸만 마주치게 되는 인연' },
        { theme: '작은 배려', description: '사소한 배려에서 시작되는 호감' },
      ],
      friend: [
        { theme: '비밀 공유', description: '서로만의 비밀을 나누게 되는' },
        { theme: '힘든 순간', description: '어려운 시기에 함께 있어주는' },
        { theme: '특별한 약속', description: '둘만의 특별한 약속을 만드는' },
      ],
      close: [
        { theme: '질투의 순간', description: '예상치 못한 질투심이 생기는' },
        { theme: '미래 이야기', description: '함께하는 미래를 상상하는' },
        { theme: '고백 직전', description: '마음을 전하고 싶은 순간' },
      ],
      intimate: [
        { theme: '첫 다툼', description: '처음으로 의견이 부딪히는' },
        { theme: '기념일', description: '특별한 날을 함께 보내는' },
        { theme: '시련 극복', description: '함께 어려움을 이겨내는' },
      ],
      lover: [
        { theme: '평범한 행복', description: '일상 속 소소한 행복' },
        { theme: '미래 계획', description: '함께할 미래를 구체적으로 계획하는' },
        { theme: '재확인', description: '서로의 마음을 다시 확인하는' },
      ],
    };

    return suggestions[relationshipStage] || suggestions.acquaintance;
  }
}

// 싱글톤 인스턴스 (필요 시)
let scenarioGeneratorInstance: ScenarioGeneratorService | null = null;

export function getScenarioGenerator(supabase: SupabaseClient): ScenarioGeneratorService {
  if (!scenarioGeneratorInstance) {
    scenarioGeneratorInstance = new ScenarioGeneratorService(supabase);
  }
  return scenarioGeneratorInstance;
}
