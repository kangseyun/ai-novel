/**
 * 폴백 시나리오 데이터 (LUMIN IP)
 * API 실패 시 사용하는 하드코딩된 시나리오.
 *
 * Tone: K-pop 클린 로맨스. 19+ 금지. LUMIN 멤버 케미 기반.
 * 기본 폴백은 안정형 리더 HAEON 시나리오.
 */

import type { ScenarioContent, ScenarioScene, ScenarioChoice } from '@/lib/ai-agent/modules/scenario-service';

// ============================================
// HAEON 첫 만남 폴백 — 새벽 연습 끝, 안부 톡
// ============================================

export const HAEON_FIRST_MEETING_SCENARIO: ScenarioContent = {
  scenes: [
    {
      id: 'scene_1',
      type: 'narration',
      text: '새벽 두 시 사십칠 분.\n핸드폰이 짧게 울렸다.',
    },
    {
      id: 'scene_2',
      type: 'narration',
      text: 'LUMIN 리더, HAEON.\n연습실에서 보낸 메시지였다.',
    },
    {
      id: 'scene_3',
      type: 'character_appear',
      text: '"...안 잤어?\n연습 막 끝났는데, 네 생각 났어."',
    },
    {
      id: 'scene_4',
      type: 'dialogue',
      character: 'HAEON',
      text: '깨어 있을 줄 알았는데, 진짜였네.',
      expression: 'soft',
    },
    {
      id: 'scene_5',
      type: 'choice',
      prompt: '리더가 새벽에 안부를 물어왔다.',
      choices: [
        {
          id: 'choice_1_caring',
          text: '오빠야말로 잘 챙겨야죠.',
          tone: 'caring',
          nextScene: 'scene_6a',
          affectionChange: 3,
        },
        {
          id: 'choice_1_warm',
          text: '톡 기다리고 있었어요.',
          tone: 'warm',
          nextScene: 'scene_6b',
          affectionChange: 4,
        },
        {
          id: 'choice_1_premium',
          text: '연습 끝나고 따뜻한 차 한 잔 같이해요.',
          tone: 'caring',
          nextScene: 'scene_6c',
          affectionChange: 5,
          isPremium: true,
        },
      ],
    },
    // Route A — 케어 응답
    {
      id: 'scene_6a',
      type: 'dialogue',
      character: 'HAEON',
      text: '...야. 내가 너 챙기려고 톡 한 건데 역공이네.',
      expression: 'flustered',
    },
    {
      id: 'scene_7a',
      type: 'narration',
      text: '핸드폰 너머로 짧게 웃는 소리가 들리는 듯했다.',
    },
    {
      id: 'scene_8a',
      type: 'dialogue',
      character: 'HAEON',
      text: '근데 그 말 들으니까 오늘 피로가 풀린다. 고마워.',
      expression: 'warm',
    },
    // Route B — 따뜻한 응답
    {
      id: 'scene_6b',
      type: 'dialogue',
      character: 'HAEON',
      text: '...진짜?',
      expression: 'touched',
    },
    {
      id: 'scene_7b',
      type: 'narration',
      text: '잠시 정적. 그가 의자에 등을 기대는 소리가 들리는 것 같았다.',
    },
    {
      id: 'scene_8b',
      type: 'dialogue',
      character: 'HAEON',
      text: '오늘 연습 좀 길었는데, 그 한마디로 다 풀렸어.',
      expression: 'soft',
    },
    // Route C — 프리미엄 루트
    {
      id: 'scene_6c',
      type: 'dialogue',
      character: 'HAEON',
      text: '...너 지금 데이트 신청한 거야?',
      expression: 'shy',
    },
    {
      id: 'scene_7c',
      type: 'narration',
      text: '농담처럼 말했지만, 메시지를 한참 지웠다 다시 쓴 흔적이 보였다.',
    },
    {
      id: 'scene_8c',
      type: 'dialogue',
      character: 'HAEON',
      text: '컴백 끝나면, 진짜로 차 한 잔 하자.',
      expression: 'warm',
    },
    // 공통 분기
    {
      id: 'scene_9',
      type: 'dialogue',
      character: 'HAEON',
      text: '있잖아.',
      expression: 'hesitant',
    },
    {
      id: 'scene_10',
      type: 'choice',
      prompt: '그가 무언가를 더 말하려 했다.',
      choices: [
        {
          id: 'choice_2_listen',
          text: '듣고 있어요.',
          tone: 'patient',
          nextScene: 'scene_11a',
          affectionChange: 3,
        },
        {
          id: 'choice_2_encourage',
          text: '말해도 돼요.',
          tone: 'friendly',
          nextScene: 'scene_11b',
          affectionChange: 2,
        },
      ],
    },
    {
      id: 'scene_11a',
      type: 'dialogue',
      character: 'HAEON',
      text: '리더 6년 차인데도 새벽엔 좀 외롭더라. 너랑 톡하면 그게 작아져.',
      expression: 'vulnerable',
    },
    {
      id: 'scene_11b',
      type: 'dialogue',
      character: 'HAEON',
      text: '내일 컴백 쇼케이스야. 응원봉 흔들어줄 거지?',
      expression: 'warm',
    },
    {
      id: 'scene_12',
      type: 'narration',
      text: '새벽 연습실에서 시작된 짧은 톡.\nLUMIN의 무대가 시작되기 전, 단 한 명의 청중에게 닿은 이야기.',
    },
    {
      id: 'scene_13',
      type: 'dialogue',
      character: 'HAEON',
      text: '내가 무대에서 너 바로 찾을 수 있게. 🤍',
      expression: 'soft',
    },
  ],
  endingConditions: {
    proceedToDm: true,
    unlockDmChat: true,
    setRelationshipStage: 'fan',
  },
};

// 기본 시나리오 별칭 (기존 export 이름 유지: JUN_FIRST_MEETING_SCENARIO)
// LUMIN의 JUN 멤버용 폴백으로도 같은 시나리오를 재사용할 수 있도록 alias 유지.
export const JUN_FIRST_MEETING_SCENARIO: ScenarioContent = HAEON_FIRST_MEETING_SCENARIO;

// ============================================
// LUMIN 캐릭터 정보
// ============================================

export const SCENARIO_CHARACTERS = {
  haeon: {
    id: 'haeon',
    name: 'HAEON',
    image: 'https://i.pravatar.cc/400?img=12',
    fullName: '김해온',
    role: 'LUMIN Leader / Main Vocal',
  },
  kael: {
    id: 'kael',
    name: 'KAEL',
    image: 'https://i.pravatar.cc/400?img=33',
    fullName: '차카엘',
    role: 'LUMIN Main Dancer / Visual',
  },
  ren: {
    id: 'ren',
    name: 'REN',
    image: 'https://i.pravatar.cc/400?img=11',
    fullName: '박렌',
    role: 'LUMIN Main Rapper',
  },
  jun: {
    id: 'jun',
    name: 'JUN',
    image: 'https://i.pravatar.cc/400?img=68',
    fullName: '서준',
    role: 'LUMIN Sub Vocal / Composer',
  },
  adrian: {
    id: 'adrian',
    name: 'ADRIAN',
    image: 'https://i.pravatar.cc/400?img=15',
    fullName: '한아드리안',
    role: 'LUMIN Visual / Sub Rapper',
  },
  sol: {
    id: 'sol',
    name: 'SOL',
    image: 'https://i.pravatar.cc/400?img=13',
    fullName: '윤솔',
    role: 'LUMIN Maknae / Sub Vocal',
  },
  noa: {
    id: 'noa',
    name: 'NOA',
    image: 'https://i.pravatar.cc/400?img=14',
    fullName: '노아 김',
    role: 'LUMIN Global / Dancer',
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
    const choice = currentScene.choices.find((c: ScenarioChoice) => c.id === choiceId);
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
