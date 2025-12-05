/**
 * 폴백 시나리오 데이터
 * API 실패 시 사용하는 하드코딩된 시나리오
 */

import type { ScenarioContent, ScenarioScene, ScenarioChoice } from '@/lib/ai-agent/modules/scenario-service';

// ============================================
// Jun 첫 만남 시나리오 (새벽 3시의 편의점)
// ============================================

export const JUN_FIRST_MEETING_SCENARIO: ScenarioContent = {
  scenes: [
    {
      id: 'scene_1',
      type: 'narration',
      text: '새벽 3시, 텅 빈 편의점.\n형광등 불빛만이 차갑게 내리쬔다.',
    },
    {
      id: 'scene_2',
      type: 'narration',
      text: '라면을 고르던 중, 익숙한 얼굴이 눈에 들어왔다.',
    },
    {
      id: 'scene_3',
      type: 'character_appear',
      text: '검은 모자를 푹 눌러쓴 남자.\n분명히... 어디서 많이 본 얼굴인데.',
    },
    {
      id: 'scene_4',
      type: 'dialogue',
      character: 'Jun',
      text: '...뭘 봐요.',
      expression: 'cold',
    },
    {
      id: 'scene_5',
      type: 'choice',
      prompt: '그가 당신을 차갑게 쏘아본다.',
      choices: [
        {
          id: 'choice_1_polite',
          text: '죄송해요, 실례했습니다.',
          tone: 'shy',
          nextScene: 'scene_6a',
          affectionChange: 2,
        },
        {
          id: 'choice_1_bold',
          text: '혹시... Jun 씨 아니세요?',
          tone: 'bold',
          nextScene: 'scene_6b',
          affectionChange: 3,
        },
        {
          id: 'choice_1_premium',
          text: '피곤해 보이시네요. 괜찮으세요?',
          tone: 'caring',
          nextScene: 'scene_6c',
          affectionChange: 5,
          isPremium: true,
        },
      ],
    },
    // Route A - 수줍은 반응
    {
      id: 'scene_6a',
      type: 'dialogue',
      character: 'Jun',
      text: '...그래요.',
      expression: 'neutral',
    },
    {
      id: 'scene_7a',
      type: 'narration',
      text: '그는 다시 진열대를 바라본다.\n하지만 어딘가 쓸쓸해 보였다.',
    },
    {
      id: 'scene_8a',
      type: 'dialogue',
      character: 'Jun',
      text: '이 시간에 편의점이라니.\n우리 처지가 비슷하네요.',
      expression: 'soft',
    },
    // Route B - 직접적인 반응
    {
      id: 'scene_6b',
      type: 'dialogue',
      character: 'Jun',
      text: '......',
      expression: 'surprised',
    },
    {
      id: 'scene_7b',
      type: 'narration',
      text: '그의 눈이 순간 흔들렸다.\n경계하는 듯, 하지만 어딘가 외로워 보이는 눈빛.',
    },
    {
      id: 'scene_8b',
      type: 'dialogue',
      character: 'Jun',
      text: '...그래요, 맞아요.\n비밀로 해줄 거죠?',
      expression: 'vulnerable',
    },
    // Route C - 프리미엄 루트
    {
      id: 'scene_6c',
      type: 'dialogue',
      character: 'Jun',
      text: '......!',
      expression: 'touched',
    },
    {
      id: 'scene_7c',
      type: 'narration',
      text: '그가 잠시 말을 잃은 것 같았다.\n아무도 그에게 그런 말을 하지 않았던 것처럼.',
    },
    {
      id: 'scene_8c',
      type: 'dialogue',
      character: 'Jun',
      text: '...고마워요.\n처음이에요, 이런 말 들은 거.',
      expression: 'soft',
    },
    // 공통 분기
    {
      id: 'scene_9',
      type: 'dialogue',
      character: 'Jun',
      text: '저기, 혹시...',
      expression: 'hesitant',
    },
    {
      id: 'scene_10',
      type: 'choice',
      prompt: '그가 무언가 말하려다 멈췄다.',
      choices: [
        {
          id: 'choice_2_wait',
          text: '(조용히 기다린다)',
          tone: 'patient',
          nextScene: 'scene_11a',
          affectionChange: 3,
        },
        {
          id: 'choice_2_encourage',
          text: '네, 말씀하세요.',
          tone: 'friendly',
          nextScene: 'scene_11b',
          affectionChange: 2,
        },
      ],
    },
    {
      id: 'scene_11a',
      type: 'dialogue',
      character: 'Jun',
      text: '...연락처, 알려줘도 될까요?\n이상하게 들리겠지만...',
      expression: 'shy',
    },
    {
      id: 'scene_11b',
      type: 'dialogue',
      character: 'Jun',
      text: '저... 연락처 알려줘도 돼요?\n왜인지 모르겠는데, 다시 보고 싶어서.',
      expression: 'flustered',
    },
    {
      id: 'scene_12',
      type: 'narration',
      text: '새벽 편의점에서 시작된 우연한 만남.\n이것이 모든 것의 시작이었다.',
    },
    {
      id: 'scene_13',
      type: 'dialogue',
      character: 'Jun',
      text: '...또 봐요.',
      expression: 'soft',
    },
  ],
  endingConditions: {
    proceedToDm: true,
    unlockDmChat: true,
    setRelationshipStage: 'acquaintance',
  },
};

// ============================================
// 캐릭터 정보
// ============================================

export const SCENARIO_CHARACTERS = {
  jun: {
    id: 'jun',
    name: 'Jun',
    image: 'https://i.pravatar.cc/400?img=68',
    fullName: '이준혁',
    role: 'K-pop Idol',
  },
};

// ============================================
// 시나리오 유틸리티
// ============================================

/**
 * 시나리오 씬 ID로 인덱스 찾기
 */
export function findSceneIndex(
  scenes: ScenarioScene[],
  sceneId: string
): number {
  return scenes.findIndex(s => s.id === sceneId);
}

/**
 * 선택지에서 다음 씬 찾기
 */
export function findNextScene(
  scenes: ScenarioScene[],
  currentSceneId: string,
  choiceId?: string
): ScenarioScene | null {
  const currentScene = scenes.find(s => s.id === currentSceneId);
  if (!currentScene) return null;

  // 선택지가 있으면 해당 선택지의 nextScene으로
  if (choiceId && currentScene.choices) {
    const choice = currentScene.choices.find(c => c.id === choiceId);
    if (choice?.nextScene) {
      return scenes.find(s => s.id === choice.nextScene) || null;
    }
  }

  // 선택지가 없으면 순차적으로 다음 씬
  const currentIndex = findSceneIndex(scenes, currentSceneId);
  if (currentIndex < 0 || currentIndex >= scenes.length - 1) {
    return null;
  }

  return scenes[currentIndex + 1];
}

/**
 * 시나리오 데이터 검증
 */
export function validateScenario(content: ScenarioContent): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!content.scenes || content.scenes.length === 0) {
    errors.push('No scenes defined');
    return { valid: false, errors };
  }

  // 모든 씬 ID가 유니크한지 확인
  const sceneIds = new Set<string>();
  for (const scene of content.scenes) {
    if (sceneIds.has(scene.id)) {
      errors.push(`Duplicate scene ID: ${scene.id}`);
    }
    sceneIds.add(scene.id);
  }

  // 모든 nextScene 참조가 유효한지 확인
  for (const scene of content.scenes) {
    if (scene.choices) {
      for (const choice of scene.choices) {
        if (choice.nextScene && !sceneIds.has(choice.nextScene)) {
          errors.push(`Invalid nextScene reference: ${choice.nextScene} in choice ${choice.id}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
