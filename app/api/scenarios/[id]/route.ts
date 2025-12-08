import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 시나리오 콘텐츠 유효성 검사
interface NormalizedScene {
  id: string;
  type: string;
  text?: string;
  choices?: Array<{ id: string; nextScene: string }>;
}

interface NormalizedContent {
  scenes: NormalizedScene[];
}

function validateScenarioContent(content: NormalizedContent): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content.scenes || content.scenes.length === 0) {
    errors.push('시나리오에 씬이 없습니다');
    return { valid: false, errors, warnings };
  }

  // 모든 씬 ID가 유니크한지 확인
  const sceneIds = new Set<string>();
  for (const scene of content.scenes) {
    if (!scene.id) {
      errors.push('씬 ID가 누락되었습니다');
      continue;
    }
    if (sceneIds.has(scene.id)) {
      errors.push(`중복 씬 ID: ${scene.id}`);
    }
    sceneIds.add(scene.id);
  }

  // 모든 nextScene 참조가 유효한지 확인
  for (const scene of content.scenes) {
    if (scene.choices) {
      for (const choice of scene.choices) {
        if (choice.nextScene && !sceneIds.has(choice.nextScene)) {
          errors.push(`잘못된 nextScene 참조: ${choice.nextScene} (씬 ${scene.id}의 선택지 ${choice.id})`);
        }
      }
    }
  }

  // 경고: 도달 불가능한 씬 확인
  const reachableScenes = new Set<string>([content.scenes[0]?.id].filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    for (const scene of content.scenes) {
      if (!reachableScenes.has(scene.id)) continue;
      if (scene.choices) {
        for (const choice of scene.choices) {
          if (choice.nextScene && !reachableScenes.has(choice.nextScene)) {
            reachableScenes.add(choice.nextScene);
            changed = true;
          }
        }
      }
      // 선택지 없는 씬은 순차적으로 다음 씬으로
      const idx = content.scenes.findIndex(s => s.id === scene.id);
      if (!scene.choices && idx < content.scenes.length - 1) {
        const nextScene = content.scenes[idx + 1];
        if (!reachableScenes.has(nextScene.id)) {
          reachableScenes.add(nextScene.id);
          changed = true;
        }
      }
    }
  }
  const unreachable = content.scenes.filter(s => !reachableScenes.has(s.id));
  if (unreachable.length > 0) {
    warnings.push(`도달 불가능한 씬: ${unreachable.map(s => s.id).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// 시나리오 콘텐츠를 camelCase로 정규화
interface RawChoice {
  id: string;
  text: string;
  tone?: string;
  next_scene?: string;
  nextScene?: string;
  affection_change?: number;
  affectionChange?: number;
  is_premium?: boolean;
  isPremium?: boolean;
  flag?: string;
}

interface RawScene {
  id: string;
  type: string;
  text?: string;
  character?: string;
  expression?: string;
  inner_thought?: string;
  innerThought?: string;
  background?: string;
  ambient?: string;
  transition?: string;
  prompt?: string;
  choices?: RawChoice[];
}

interface RawContent {
  scenes?: RawScene[];
  ending_conditions?: {
    proceed_to_dm?: boolean;
    unlock_dm_chat?: boolean;
    set_relationship_stage?: string;
    initial_affection_by_choice?: Record<string, number>;
  };
  endingConditions?: {
    proceedToDm?: boolean;
    unlockDmChat?: boolean;
    setRelationshipStage?: string;
    initialAffectionByChoice?: Record<string, number>;
  };
}

function normalizeScenarioContent(content: RawContent) {
  const scenes = (content.scenes || []).map((scene) => ({
    id: scene.id,
    type: scene.type,
    text: scene.text,
    character: scene.character,
    expression: scene.expression,
    innerThought: scene.inner_thought ?? scene.innerThought,
    background: scene.background,
    ambient: scene.ambient,
    transition: scene.transition,
    prompt: scene.prompt,
    choices: scene.choices?.map((choice) => ({
      id: choice.id,
      text: choice.text,
      tone: choice.tone,
      nextScene: choice.next_scene ?? choice.nextScene ?? '',
      affectionChange: choice.affection_change ?? choice.affectionChange ?? 0,
      isPremium: choice.is_premium ?? choice.isPremium ?? false,
      flag: choice.flag,
    })),
  }));

  const rawEnding = content.ending_conditions || content.endingConditions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ending = rawEnding as any;
  const endingConditions = rawEnding ? {
    proceedToDm: ending.proceed_to_dm ?? ending.proceedToDm,
    unlockDmChat: ending.unlock_dm_chat ?? ending.unlockDmChat,
    setRelationshipStage: ending.set_relationship_stage ?? ending.setRelationshipStage,
    initialAffectionByChoice: ending.initial_affection_by_choice ?? ending.initialAffectionByChoice,
  } : undefined;

  return { scenes, endingConditions };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: scenario, error } = await supabase
      .from('scenario_templates')
      .select(`
        *,
        persona_core (
          id,
          name,
          full_name,
          appearance,
          core_personality,
          speech_patterns,
          behavior_by_stage,
          profile_image_url
        )
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching scenario:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Scenario not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Transform to frontend format
    const personaCore = scenario.persona_core as {
      id: string;
      name: string;
      full_name: string;
      appearance?: Record<string, unknown>;
      core_personality?: Record<string, unknown>;
      speech_patterns?: Record<string, unknown>;
      behavior_by_stage?: Record<string, unknown>;
      profile_image_url?: string | null;
    } | null;

    // 콘텐츠 정규화 (snake_case → camelCase)
    const normalizedContent = normalizeScenarioContent(scenario.content || { scenes: [] });

    // 유효성 검사
    const validation = validateScenarioContent(normalizedContent);
    if (!validation.valid) {
      console.error(`[Scenario ${id}] Validation errors:`, validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.warn(`[Scenario ${id}] Validation warnings:`, validation.warnings);
    }

    return NextResponse.json({
      id: scenario.id,
      personaId: scenario.persona_id,
      title: scenario.title,
      description: scenario.description,
      scenarioType: scenario.scenario_type,
      content: normalizedContent,
      character: personaCore ? {
        id: personaCore.id,
        name: personaCore.name,
        fullName: personaCore.full_name,
        appearance: personaCore.appearance,
        personality: personaCore.core_personality,
        speechPatterns: personaCore.speech_patterns,
        behaviorByStage: personaCore.behavior_by_stage,
        profileImageUrl: personaCore.profile_image_url,
      } : null,
      // 개발 환경에서만 유효성 검사 결과 포함
      ...(process.env.NODE_ENV === 'development' && {
        _validation: validation,
      }),
    });
  } catch (error) {
    console.error('Error in scenario API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenario' },
      { status: 500 }
    );
  }
}
