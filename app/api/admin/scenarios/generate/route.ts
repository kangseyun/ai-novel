import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ScenarioGeneratorService } from '@/lib/ai-agent/modules/scenario-generator-service';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      personaId,
      scenarioType,
      theme,
      targetEmotion,
      situationHint,
      relationshipStage,
      minAffection,
      sceneCount,
      choicesPerScene,
      includePremiumChoice,
    } = body;

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    const generator = new ScenarioGeneratorService(supabaseAdmin);

    let scenario;

    if (scenarioType === 'static') {
      scenario = await generator.generateStaticScenario({
        personaId,
        scenarioType: 'static',
        theme,
        targetEmotion,
        situationHint,
        relationshipStage,
        minAffection,
        sceneCount,
        choicesPerScene,
        includePremiumChoice,
      });
    } else if (scenarioType === 'guided') {
      const plotPoints = await generator.generateGuidedPlotPoints(
        {
          personaId,
          scenarioType: 'guided',
          theme,
          targetEmotion,
          situationHint,
          relationshipStage,
          minAffection,
        },
        sceneCount
      );

      scenario = {
        id: `guided_${Date.now()}`,
        title: `${theme} (Guided)`,
        description: `AI가 실시간으로 대사를 생성하는 가이드 시나리오`,
        scenes: plotPoints?.map((pp, i) => ({
          id: pp.id,
          sceneNumber: i + 1,
          sceneType: 'plot_point',
          content: {
            text: pp.description,
            speaker: 'narration',
            emotion: pp.emotionalBeat,
          },
          metadata: {
            plotType: pp.plotType,
            speakerGuidance: pp.speakerGuidance,
            userChoiceGuidance: pp.userChoiceGuidance,
            transitionHint: pp.transitionHint,
          },
        })) || [],
        metadata: {
          theme,
          estimatedDuration: `${(sceneCount || 4) * 2}분`,
          emotionalArc: plotPoints?.map(pp => pp.emotionalBeat) || [],
        },
      };
    } else {
      // Dynamic 시나리오는 템플릿만 생성
      scenario = {
        id: `dynamic_${Date.now()}`,
        title: `${theme} (Dynamic)`,
        description: `트리거 조건에 따라 AI가 완전히 생성하는 동적 시나리오`,
        scenes: [{
          id: 'dynamic_trigger',
          sceneNumber: 1,
          sceneType: 'dynamic',
          content: {
            text: '이 시나리오는 트리거 조건이 충족되면 AI가 실시간으로 생성합니다.',
            speaker: 'narration',
          },
        }],
        metadata: {
          theme,
          estimatedDuration: '가변',
          emotionalArc: [targetEmotion],
          isDynamic: true,
        },
      };
    }

    if (!scenario) {
      return NextResponse.json(
        { error: 'Failed to generate scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scenario });
  } catch (error) {
    console.error('Error generating scenario:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
