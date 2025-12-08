import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scenario,
      personaId,
      generationMode,
      triggerConditions,
      isActive,
    } = body;

    if (!scenario || !personaId) {
      return NextResponse.json(
        { error: 'scenario and personaId are required' },
        { status: 400 }
      );
    }

    // 시나리오 ID 생성 (중복 방지)
    const scenarioId = `${personaId}_${generationMode}_${Date.now()}`;

    // 시나리오 저장
    const { data, error } = await supabaseAdmin
      .from('scenario_templates')
      .insert({
        id: scenarioId,
        persona_id: personaId,
        title: scenario.title,
        description: scenario.description,
        scenario_type: 'story_episode',
        generation_mode: generationMode,
        trigger_conditions: triggerConditions || {},
        content: {
          scenes: scenario.scenes,
        },
        min_affection: triggerConditions?.minAffection || 0,
        min_relationship_stage: triggerConditions?.relationshipStage || 'stranger',
        is_active: isActive,
        metadata: scenario.metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving scenario:', error);
      throw error;
    }

    // Guided 시나리오인 경우 플롯 포인트도 저장
    if (generationMode === 'guided' && scenario.scenes) {
      const plotPointData = scenario.scenes
        .filter((scene: { metadata?: { plotType?: string } }) => scene.metadata?.plotType)
        .map((scene: {
          id: string;
          sceneNumber: number;
          content: { text: string; emotion?: string };
          metadata?: {
            plotType?: string;
            speakerGuidance?: string;
            userChoiceGuidance?: string;
            transitionHint?: string
          };
        }) => ({
          scenario_id: scenarioId,
          plot_point_number: scene.sceneNumber,
          plot_type: scene.metadata?.plotType,
          description: scene.content.text,
          emotional_beat: scene.content.emotion || '',
          speaker_guidance: scene.metadata?.speakerGuidance || '',
          user_choice_guidance: scene.metadata?.userChoiceGuidance || null,
          transition_hint: scene.metadata?.transitionHint || null,
        }));

      if (plotPointData.length > 0) {
        const { error: plotError } = await supabaseAdmin
          .from('guided_scenario_plots')
          .insert(plotPointData);

        if (plotError) {
          console.error('Error saving plot points:', plotError);
          // 플롯 포인트 저장 실패해도 시나리오는 유지
        }
      }
    }

    // Dynamic 시나리오인 경우 템플릿 저장
    if (generationMode === 'dynamic') {
      const { error: dynamicError } = await supabaseAdmin
        .from('dynamic_scenario_templates')
        .insert({
          id: `dyn_${scenarioId}`,
          name: scenario.title,
          description: scenario.description,
          persona_id: personaId,
          trigger_conditions: triggerConditions || {},
          generation_prompt: scenario.metadata?.generationPrompt || '',
          blocked_topics: [],
          required_elements: [],
          max_turns: 10,
          emotional_guardrails: [],
          fallback_responses: ['잠시 생각 중이야...'],
          is_active: isActive,
        });

      if (dynamicError) {
        console.error('Error saving dynamic template:', dynamicError);
        // 동적 템플릿 저장 실패해도 시나리오는 유지
      }
    }

    return NextResponse.json({ scenarioId: data.id });
  } catch (error) {
    console.error('Error saving scenario:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
