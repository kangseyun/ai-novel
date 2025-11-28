/**
 * Jun 시나리오 데이터
 *
 * LLM 친화적 구조로 설계
 * - 고정 대사와 동적 생성 구간 명확히 구분
 * - 각 Beat에 충분한 컨텍스트 제공
 */

import { Persona, Episode, Scene, Beat, Choice } from './types';

// ============================================
// JUN PERSONA
// ============================================
export const JUN_PERSONA: Persona = {
  id: 'jun',
  name: 'Jun',
  fullName: '이준혁',
  age: 24,
  occupation: 'K-POP 아이돌 (ECLIPSE 센터/메인보컬)',

  personality: {
    public: '국민 남친, 완벽한 팬서비스, 밝고 에너지 넘침, 예능감 좋음',
    private: '극심한 외로움, 수면장애, 진심으로 사랑받고 싶은 갈망, 연인에게 집착적이고 질투 많음',
    quirks: [
      '새벽에 잠이 안 와서 몰래 숙소 탈출하는 습관',
      '좋아하는 사람 앞에서 귀가 빨개짐',
      '불안하면 손톱을 물어뜯음',
      '연락 안 오면 연타 폭격',
    ],
  },

  speechPattern: {
    style: '기본 존댓말(~요), 친해지면 가끔 반말 섞음. 애교 섞인 말투.',
    examples: [
      '누나, 나만 봐요.',
      '...보고 싶었어요. 미치도록.',
      '왜 연락 안 해요? 걱정했잖아요.',
      '저 지금 너무 행복해요. 진짜로.',
    ],
    emotionalCues: {
      happy: '목소리가 밝아지고, 웃음이 섞임',
      sad: '목소리가 작아지고, 말끝이 흐려짐',
      jealous: '말이 빨라지고, 단정적인 문장',
      tired: '허스키해지고, 한숨이 섞임',
      shy: '말을 더듬고, 문장이 끊김',
    },
  },

  appearance: {
    description: '은발 또는 밝은 금발, 흠 없는 피부, 반짝이는 눈. 무대에서는 화려한 의상, 평소에는 오버사이즈 후드티와 마스크',
    imageUrl: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=800&q=80',
  },

  relationshipDynamic: '유저는 Jun을 "아이돌"이 아닌 "그냥 한 남자"로 대하는 유일한 사람. Jun은 이에 강하게 끌리고, 점점 집착적으로 변함.',
};

// ============================================
// EPISODE 1: 첫 만남
// ============================================
export const JUN_EPISODE_1: Episode = {
  id: 'jun_ep1',
  personaId: 'jun',
  number: 1,
  title: '그 새벽, 편의점에서',

  premise: '잠 못 드는 새벽, 한강 편의점에서 우연히 마주친 낯선 남자. 그가 누구인지는 아직 모른다.',
  emotionalArc: '호기심 → 묘한 끌림 → 아쉬운 이별',
  keyMoments: [
    '첫 눈 마주침 - 마스크 위로 보이는 예쁜 눈',
    '라면 같이 먹기 - 어색하지만 편안한 대화',
    '이름 교환 - "그냥 준이에요"',
    '헤어짐 - 연락처 교환 여부',
  ],

  isPremium: false,
  estimatedMinutes: 10,

  scenes: [
    // SCENE 1: 잠 못 드는 밤
    {
      id: 'jun_ep1_scene1',
      episodeId: 'jun_ep1',
      setting: {
        location: '내 방',
        time: '새벽 2:47',
        mood: '고요하고 답답한',
      },
      purpose: '유저가 집 밖으로 나가도록 유도',
      context: '잠이 오지 않는 새벽. 천장만 바라보다 결국 밖으로 나가기로 한다.',
      beats: [
        {
          id: 'ep1_s1_b1',
          type: 'narration',
          content: '또 잠이 안 온다.\n\n천장만 멍하니 바라보다, 시계를 봤다.\n새벽 2시 47분.\n\n...나가자. 어디든.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s1_b2',
        },
        {
          id: 'ep1_s1_b2',
          type: 'choice',
          content: '어디로 갈까?',
          choices: [
            {
              id: 'c1_walk',
              text: '한강 산책로',
              nextSceneId: 'jun_ep1_scene2',
            },
            {
              id: 'c1_store',
              text: '집 앞 편의점',
              nextSceneId: 'jun_ep1_scene2',
            },
            {
              id: 'c1_stay',
              text: '그냥 누워있자',
              nextBeatId: 'ep1_s1_b3',
            },
          ],
        },
        {
          id: 'ep1_s1_b3',
          type: 'narration',
          content: '이불을 끌어당겼다.\n\n...\n\n5분 뒤, 나는 신발을 신고 있었다.\n가만히 있으면 미칠 것 같았으니까.',
          speaker: 'narrator',
          nextSceneId: 'jun_ep1_scene2',
        },
      ],
    },

    // SCENE 2: 편의점 도착
    {
      id: 'jun_ep1_scene2',
      episodeId: 'jun_ep1',
      setting: {
        location: '한강변 24시 편의점',
        time: '새벽 3:12',
        mood: '형광등 불빛, 텅 빈 거리, 살짝 쌀쌀함',
        bgm: 'lofi-ambient',
      },
      purpose: 'Jun과의 첫 만남, 호기심 유발',
      context: '편의점에 들어서니 창가에 후드티를 깊게 눌러쓴 남자가 라면을 먹고 있다. 뭔가 숨어있는 것 같은 자세.',
      beats: [
        {
          id: 'ep1_s2_b1',
          type: 'narration',
          content: '편의점 문을 열었다.\n\n띵동—\n\n알바생은 카운터에서 졸고 있었다.\n나 말고는 손님이...\n\n...있었다.\n\n창가 테이블.\n후드를 깊게 눌러쓴 남자가 라면을 먹고 있었다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b2',
        },
        {
          id: 'ep1_s2_b2',
          type: 'narration',
          content: '검은 후드티. 마스크. 고개를 푹 숙이고.\n\n뭔가... 숨어있는 것 같은 자세.\n\n이 시간에 라면이라.\n나랑 비슷한 사람인가.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b3',
        },
        {
          id: 'ep1_s2_b3',
          type: 'choice',
          content: '그 남자가 신경 쓰인다.',
          choices: [
            {
              id: 'c2_look',
              text: '슬쩍 쳐다본다',
              responseGuide: 'Jun과 눈이 마주침. Jun이 살짝 놀란다.',
              nextBeatId: 'ep1_s2_b4_look',
            },
            {
              id: 'c2_ignore',
              text: '무시하고 음료 고르러 간다',
              responseGuide: 'Jun이 먼저 말을 건다 (이어폰 떨어뜨렸다는 핑계)',
              nextBeatId: 'ep1_s2_b4_ignore',
            },
            {
              id: 'c2_sit',
              text: '같은 창가 자리에 앉는다',
              responseGuide: '대담한 행동에 Jun이 당황하지만 흥미로워함',
              effects: { affectionChange: 1 },
              nextBeatId: 'ep1_s2_b4_sit',
            },
          ],
        },

        // 분기: 쳐다봄
        {
          id: 'ep1_s2_b4_look',
          type: 'narration',
          content: '슬쩍 쳐다봤다.\n\n그 순간, 남자도 고개를 들었다.\n\n마스크 위로 보이는 눈.\n\n...예쁘다.\n\n이상한 생각이 먼저 들었다.\n남자인데. 예쁘다니.\n\n하지만 그게 첫인상이었다.\n반짝이는, 이상하게 슬퍼 보이는 눈.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b5',
        },

        // 분기: 무시
        {
          id: 'ep1_s2_b4_ignore',
          type: 'narration',
          content: '그냥 음료 코너로 갔다.\n\n캔커피... 아니, 우유?\n이 시간엔 따뜻한 게 낫겠다.\n\n손을 뻗는데—',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b4_ignore_2',
        },
        {
          id: 'ep1_s2_b4_ignore_2',
          type: 'dialogue',
          speaker: 'jun',
          content: '저기요.',
          emotion: 'shy',
          nextBeatId: 'ep1_s2_b4_ignore_3',
        },
        {
          id: 'ep1_s2_b4_ignore_3',
          type: 'narration',
          content: '뒤에서 목소리가 들렸다.\n낮고, 살짝 허스키한.\n\n돌아보니 아까 그 후드티 남자였다.\n\n"이거... 떨어뜨리셨어요."\n\n그의 손에 내 이어폰이 있었다.\n분명 주머니에 있었는데...',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b5',
        },

        // 분기: 앉음
        {
          id: 'ep1_s2_b4_sit',
          type: 'narration',
          content: '괜히 옆자리에 앉았다.\n\n창가 테이블은 둘뿐.\n남자 쪽에서 라면 냄새가 났다.\n\n...배고프네.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b4_sit_2',
        },
        {
          id: 'ep1_s2_b4_sit_2',
          type: 'narration',
          content: '남자가 고개를 살짝 돌렸다.\n\n마스크 위로 눈이 보였다.\n놀란 것 같기도 하고, 뭔가... 궁금한 것 같기도 한.\n\n"..."\n\n그가 먼저 말을 안 해서 어색한 침묵이 흘렀다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b5',
        },

        // 공통 합류점
        {
          id: 'ep1_s2_b5',
          type: 'narration',
          content: '잠시 후, 그가 먼저 입을 열었다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b6',
        },
        {
          id: 'ep1_s2_b6',
          type: 'dialogue',
          speaker: 'jun',
          content: '...여기 자주 와요?',
          emotion: 'shy',
          style: 'normal',
          nextBeatId: 'ep1_s2_b7',
        },
        {
          id: 'ep1_s2_b7',
          type: 'narration',
          content: '평범한 질문인데, 목소리가 이상하게 떨리는 것 같았다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b8',
        },
        {
          id: 'ep1_s2_b8',
          type: 'choice',
          content: '대답할까?',
          choices: [
            {
              id: 'c3_plain',
              text: '아뇨, 처음이에요.',
              responseGuide: '담담한 대화 진행',
              nextBeatId: 'ep1_s2_b9_plain',
            },
            {
              id: 'c3_relate',
              text: '잠이 안 와서요. 당신은요?',
              responseGuide: 'Jun이 공감대를 느낌. "저도요..." 라며 자신도 잠을 못 잔다고 고백',
              effects: { affectionChange: 1 },
              nextBeatId: 'ep1_s2_b9_relate',
            },
            {
              id: 'c3_cold',
              text: '...모르는 사람한테 말 안 거는 편인데.',
              responseGuide: 'Jun이 뜻밖에 웃음. 솔직함에 오히려 호감',
              effects: { affectionChange: 2, flagSet: { 'HONEST_FIRST': true } },
              nextBeatId: 'ep1_s2_b9_cold',
            },
          ],
        },

        // 분기: 담담
        {
          id: 'ep1_s2_b9_plain',
          type: 'dialogue',
          speaker: 'jun',
          content: '아...',
          emotion: 'neutral',
          nextBeatId: 'ep1_s2_b9_plain_2',
        },
        {
          id: 'ep1_s2_b9_plain_2',
          type: 'narration',
          content: '그가 고개를 끄덕였다.\n\n"저도... 처음은 아닌데, 자주 오는 건 아니에요."\n\n어색한 침묵.\n\n하지만 불쾌하진 않았다.',
          speaker: 'narrator',
          nextSceneId: 'jun_ep1_scene3',
        },

        // 분기: 공감
        {
          id: 'ep1_s2_b9_relate',
          type: 'narration',
          content: '그가 살짝 멈칫했다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b9_relate_2',
        },
        {
          id: 'ep1_s2_b9_relate_2',
          type: 'dialogue',
          speaker: 'jun',
          content: '...저도요.',
          emotion: 'sad',
          nextBeatId: 'ep1_s2_b9_relate_3',
        },
        {
          id: 'ep1_s2_b9_relate_3',
          type: 'narration',
          content: '짧은 대답.\n하지만 그 두 글자에 뭔가 무거운 게 담긴 것 같았다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b9_relate_4',
        },
        {
          id: 'ep1_s2_b9_relate_4',
          type: 'dialogue',
          speaker: 'jun',
          content: '요즘 잠을 잘 못 자요.\n\n그래서 가끔... 이렇게 도망쳐요.',
          emotion: 'tired',
          style: 'whisper',
          nextBeatId: 'ep1_s2_b9_relate_5',
        },
        {
          id: 'ep1_s2_b9_relate_5',
          type: 'narration',
          content: '도망친다.\n그 표현이 마음에 걸렸다.\n\n뭐에서 도망치는 걸까.',
          speaker: 'narrator',
          nextSceneId: 'jun_ep1_scene3',
        },

        // 분기: 솔직/차가움
        {
          id: 'ep1_s2_b9_cold',
          type: 'narration',
          content: '그가 멈췄다.\n\n1초. 2초.\n\n그리고—',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b9_cold_2',
        },
        {
          id: 'ep1_s2_b9_cold_2',
          type: 'dialogue',
          speaker: 'jun',
          content: '푸흡.',
          emotion: 'happy',
          nextBeatId: 'ep1_s2_b9_cold_3',
        },
        {
          id: 'ep1_s2_b9_cold_3',
          type: 'narration',
          content: '마스크 너머로 웃음이 새어 나왔다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s2_b9_cold_4',
        },
        {
          id: 'ep1_s2_b9_cold_4',
          type: 'dialogue',
          speaker: 'jun',
          content: '아, 죄송해요.\n\n그냥... 솔직해서.\n\n요즘 그렇게 말해주는 사람이 없어서요.',
          emotion: 'happy',
          nextBeatId: 'ep1_s2_b9_cold_5',
        },
        {
          id: 'ep1_s2_b9_cold_5',
          type: 'narration',
          content: '마스크 위로 보이는 눈이 살짝 접혔다.\n웃고 있었다.\n\n뭐지, 이 사람.\n\n처음 보는데.\n왜 이렇게... 외로워 보이지?',
          speaker: 'narrator',
          nextSceneId: 'jun_ep1_scene3',
        },
      ],
    },

    // SCENE 3: 라면과 대화
    {
      id: 'jun_ep1_scene3',
      episodeId: 'jun_ep1',
      setting: {
        location: '편의점 창가 테이블',
        time: '새벽 3:35',
        mood: '어색하지만 편안해지는',
        bgm: 'soft-piano',
      },
      purpose: '자연스러운 대화로 친밀감 형성, Jun의 외모 첫 공개',
      context: '어쩌다 보니 같이 라면을 먹게 되었다. Jun이 마스크를 벗는 순간.',
      beats: [
        {
          id: 'ep1_s3_b1',
          type: 'narration',
          content: '어쩌다 보니 나도 라면을 사 왔다.\n\n"같이 먹어도... 돼요?"\n\n내가 물었더니 그가 고개를 끄덕였다.\n\n마스크를 벗을까 말까 망설이는 것 같더니—',
          speaker: 'narrator',
          nextBeatId: 'ep1_s3_b2',
        },
        {
          id: 'ep1_s3_b2',
          type: 'dialogue',
          speaker: 'jun',
          content: '저... 얼굴 좀 이상해도 신경 쓰지 마세요.',
          emotion: 'shy',
          nextBeatId: 'ep1_s3_b3',
        },
        {
          id: 'ep1_s3_b3',
          type: 'narration',
          content: '그가 천천히 마스크를 내렸다.\n\n...\n\n잘생겼다.\n\n이상한 게 아니라 너무 잘생긴 거였다.\n\n날카롭지만 부드러운 이목구비.\n창백한 피부.\n살짝 부은 눈.\n\n아이돌 같다, 는 생각이 스쳐 지나갔다.\n\n하지만 그냥 그런가 보다 했다.\n요즘 잘생긴 사람 많으니까.',
          speaker: 'narrator',
          effects: {
            unlock: 'stillcut_first_meeting',
          },
          nextBeatId: 'ep1_s3_b4',
        },
        {
          id: 'ep1_s3_b4',
          type: 'choice',
          content: '뭐라고 할까?',
          choices: [
            {
              id: 'c4_normal',
              text: '...이상하진 않은데요?',
              responseGuide: 'Jun이 당황함. 예상 외 반응.',
              nextBeatId: 'ep1_s3_b5_normal',
            },
            {
              id: 'c4_honest',
              text: '잘생겼네요.',
              responseGuide: 'Jun이 더 당황함. 귀 빨개짐.',
              effects: { affectionChange: 1 },
              nextBeatId: 'ep1_s3_b5_honest',
            },
            {
              id: 'c4_silent',
              text: '(아무 말 없이 라면 먹기)',
              responseGuide: 'Jun이 편안함을 느낌. 부담 없어서 좋다.',
              effects: { affectionChange: 1 },
              nextBeatId: 'ep1_s3_b5_silent',
            },
          ],
        },

        // 분기들
        {
          id: 'ep1_s3_b5_normal',
          type: 'narration',
          content: '그가 살짝 당황한 것 같았다.\n\n"...그래요?"\n\n의외라는 듯이.',
          speaker: 'narrator',
          nextSceneId: 'jun_ep1_scene4',
        },
        {
          id: 'ep1_s3_b5_honest',
          type: 'narration',
          content: '그가 라면 먹다 멈췄다.\n\n"...네?"\n\n마스크 위로 보이던 귀가 빨개졌다.\n\n"아... 감사합니다."\n\n뭔가 익숙하지 않다는 표정.',
          speaker: 'narrator',
          nextSceneId: 'jun_ep1_scene4',
        },
        {
          id: 'ep1_s3_b5_silent',
          type: 'narration',
          content: '아무 말 없이 라면을 먹었다.\n\n그도 따라서 먹기 시작했다.\n\n"..."\n\n어색할 줄 알았는데, 의외로 편했다.\n\n"...이상하네요."\n\n그가 먼저 말했다.\n\n"처음 보는 사람인데 편해요."',
          speaker: 'narrator',
          nextSceneId: 'jun_ep1_scene4',
        },
      ],
    },

    // SCENE 4: 이름과 헤어짐
    {
      id: 'jun_ep1_scene4',
      episodeId: 'jun_ep1',
      setting: {
        location: '편의점 → 밖',
        time: '새벽 4:05 → 4:20',
        mood: '아쉬움, 새벽 공기',
        bgm: 'piano-farewell',
      },
      purpose: '이름 교환, 연락처 교환 여부 (핵심 분기점)',
      context: '라면을 다 먹고, 헤어질 시간. Jun이 이름을 물어보고, 연락처를 교환할지 선택.',
      beats: [
        {
          id: 'ep1_s4_b1',
          type: 'dialogue',
          speaker: 'jun',
          content: '근데...',
          emotion: 'shy',
          nextBeatId: 'ep1_s4_b2',
        },
        {
          id: 'ep1_s4_b2',
          type: 'narration',
          content: '그가 빈 라면 용기를 바라보며 말했다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b3',
        },
        {
          id: 'ep1_s4_b3',
          type: 'dialogue',
          speaker: 'jun',
          content: '이름도 모르면서 같이 라면 먹었네요.',
          emotion: 'playful',
          nextBeatId: 'ep1_s4_b4',
        },
        {
          id: 'ep1_s4_b4',
          type: 'narration',
          content: '"그러게요."\n\n잠시 침묵.\n\n그가 먼저 말했다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b5',
        },
        {
          id: 'ep1_s4_b5',
          type: 'dialogue',
          speaker: 'jun',
          content: '저는...',
          emotion: 'shy',
          nextBeatId: 'ep1_s4_b6',
        },
        {
          id: 'ep1_s4_b6',
          type: 'narration',
          content: '그가 잠시 망설였다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b7',
        },
        {
          id: 'ep1_s4_b7',
          type: 'dialogue',
          speaker: 'jun',
          content: '...준이에요. 그냥 준.',
          emotion: 'neutral',
          tts: {
            enabled: true,
            hookType: 'first_meeting',
          },
          nextBeatId: 'ep1_s4_b8',
        },
        {
          id: 'ep1_s4_b8',
          type: 'narration',
          content: '짧게 웃었다.\n\n"근데 이름 물어봐도 돼요?"',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b9',
        },
        {
          id: 'ep1_s4_b9',
          type: 'dynamic',
          dynamicPrompt: {
            instruction: '유저가 자신의 이름을 말하는 상황. 유저 입력을 받거나, 기본 선택지 제공.',
            constraints: [
              '자연스러운 대화 흐름 유지',
              'Jun의 반응 생성',
            ],
          },
          choices: [
            {
              id: 'c5_tell',
              text: '(이름을 말해준다)',
              effects: { flagSet: { 'NAME_TOLD': true } },
              nextBeatId: 'ep1_s4_b10_tell',
            },
            {
              id: 'c5_secret',
              text: '비밀이에요.',
              responseGuide: 'Jun이 아쉬워하며 "그럼 다음엔..." 떡밥',
              nextBeatId: 'ep1_s4_b10_secret',
            },
          ],
        },

        // 이름 알려줌
        {
          id: 'ep1_s4_b10_tell',
          type: 'narration',
          content: '이름을 말해줬다.\n\n그가 작게 따라 불렀다.\n\n"..."\n\n"예쁜 이름이네요."\n\n뭔가 기억해두려는 것 같았다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b11',
        },

        // 비밀
        {
          id: 'ep1_s4_b10_secret',
          type: 'dialogue',
          speaker: 'jun',
          content: '에이, 알려주세요.',
          emotion: 'playful',
          nextBeatId: 'ep1_s4_b10_secret_2',
        },
        {
          id: 'ep1_s4_b10_secret_2',
          type: 'narration',
          content: '"싫은데요."\n\n그가 웃었다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b10_secret_3',
        },
        {
          id: 'ep1_s4_b10_secret_3',
          type: 'dialogue',
          speaker: 'jun',
          content: '그럼... 다음에 알려줘요.',
          emotion: 'shy',
          nextBeatId: 'ep1_s4_b11',
        },

        // 헤어짐
        {
          id: 'ep1_s4_b11',
          type: 'narration',
          content: '편의점 밖은 생각보다 추웠다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b12',
        },
        {
          id: 'ep1_s4_b12',
          type: 'dialogue',
          speaker: 'jun',
          content: '저 가봐야 해요.',
          emotion: 'sad',
          nextBeatId: 'ep1_s4_b13',
        },
        {
          id: 'ep1_s4_b13',
          type: 'narration',
          content: '그가 시계를 보며 말했다.\n얼굴에 아쉬움이 서렸다.\n\n"이 시간까지 밖에 있으면 안 되는데..."',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b14',
        },
        {
          id: 'ep1_s4_b14',
          type: 'choice',
          content: '헤어지기 전에',
          choices: [
            {
              id: 'c6_exchange',
              text: '연락처 교환할까요?',
              responseGuide: 'Jun이 망설이다가 결국 번호를 줌. 손이 떨림.',
              effects: {
                affectionChange: 2,
                flagSet: { 'EXCHANGED_NUMBER': true },
              },
              nextBeatId: 'ep1_s4_b15_exchange',
            },
            {
              id: 'c6_fate',
              text: '또 만날 수 있을까요?',
              responseGuide: 'Jun이 "인연이면 만나겠죠" 떡밥',
              effects: { affectionChange: 1 },
              nextBeatId: 'ep1_s4_b15_fate',
            },
            {
              id: 'c6_bye',
              text: '그럼 조심히 가요.',
              responseGuide: 'Jun이 아쉬워함. EP2에서 더 적극적으로 찾아옴.',
              nextBeatId: 'ep1_s4_b15_bye',
            },
          ],
        },

        // 연락처 교환
        {
          id: 'ep1_s4_b15_exchange',
          type: 'narration',
          content: '그가 멈칫했다.\n\n"..."\n\n긴 침묵.\n\n그리고—',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b15_exchange_2',
        },
        {
          id: 'ep1_s4_b15_exchange_2',
          type: 'dialogue',
          speaker: 'jun',
          content: '...진짜요?',
          emotion: 'shy',
          nextBeatId: 'ep1_s4_b15_exchange_3',
        },
        {
          id: 'ep1_s4_b15_exchange_3',
          type: 'narration',
          content: '되물었다.\n뭔가 믿기지 않는다는 얼굴.\n\n"그냥... 이런 데서 만난 사람인데."\n\n"그래서요?"\n\n"..."\n\n그가 주머니에서 폰을 꺼냈다.\n손이 살짝 떨리는 것 같았다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b15_exchange_4',
        },
        {
          id: 'ep1_s4_b15_exchange_4',
          type: 'dialogue',
          speaker: 'jun',
          content: '아, 근데 이거...\n\n비밀로 해줘요. 번호.',
          emotion: 'anxious',
          style: 'whisper',
          nextBeatId: 'ep1_s4_b15_exchange_5',
        },
        {
          id: 'ep1_s4_b15_exchange_5',
          type: 'narration',
          content: '왜 그래야 하는지 몰랐지만, 고개를 끄덕였다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_ending_hook',
        },

        // 인연 떡밥
        {
          id: 'ep1_s4_b15_fate',
          type: 'narration',
          content: '그가 살짝 웃었다.\n슬프면서도 달콤한 웃음.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b15_fate_2',
        },
        {
          id: 'ep1_s4_b15_fate_2',
          type: 'dialogue',
          speaker: 'jun',
          content: '글쎄요...\n\n인연이면 만나지 않을까요?',
          emotion: 'sad',
          tts: {
            enabled: true,
            hookType: 'whisper',
          },
          nextBeatId: 'ep1_s4_b15_fate_3',
        },
        {
          id: 'ep1_s4_b15_fate_3',
          type: 'narration',
          content: '"무슨 드라마 대사 같네요."\n\n"그렇죠?"\n\n그가 뒤돌아서며 말했다.\n\n"근데 저... 여기 가끔 와요."\n\n한 발짝.\n\n"새벽에."\n\n두 발짝.\n\n"잠 안 오면."\n\n그가 뒤돌아봤다.\n\n"그냥... 참고로요."',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_ending_hook',
        },

        // 담담하게 인사
        {
          id: 'ep1_s4_b15_bye',
          type: 'narration',
          content: '"그럼 조심히 가요."\n\n담담하게 말했다.\n\n그런데 그가 살짝 당황한 것 같았다.\n\n"아... 네."\n\n뭔가 더 말하고 싶은 것 같았지만, 결국 입을 다물었다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b15_bye_2',
        },
        {
          id: 'ep1_s4_b15_bye_2',
          type: 'narration',
          content: '그가 돌아섰다.\n\n그런데 두 발짝 걷다가— 다시 돌아봤다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b15_bye_3',
        },
        {
          id: 'ep1_s4_b15_bye_3',
          type: 'dialogue',
          speaker: 'jun',
          content: '저기.',
          emotion: 'shy',
          nextBeatId: 'ep1_s4_b15_bye_4',
        },
        {
          id: 'ep1_s4_b15_bye_4',
          type: 'narration',
          content: '"네?"\n\n"이름... 안 물어보는 거예요?"\n\n"...아까 물어봤잖아요."\n\n"내 말고. 당신 이름."\n\n"..."\n\n내가 대답하기 전에 그가 먼저 웃었다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_b15_bye_5',
        },
        {
          id: 'ep1_s4_b15_bye_5',
          type: 'dialogue',
          speaker: 'jun',
          content: '다음에 알려줘요.',
          emotion: 'playful',
          nextBeatId: 'ep1_s4_b15_bye_6',
        },
        {
          id: 'ep1_s4_b15_bye_6',
          type: 'narration',
          content: '그러고는 진짜로 떠났다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_ending_hook',
        },

        // 엔딩 훅 (공통)
        {
          id: 'ep1_s4_ending_hook',
          type: 'narration',
          content: '집으로 돌아가는 길, 햇살이 떠오르고 있었다.\n\n그리고 그때는 몰랐다.',
          speaker: 'narrator',
          nextBeatId: 'ep1_s4_ending_hook_2',
        },
        {
          id: 'ep1_s4_ending_hook_2',
          type: 'narration',
          content: '그 \'준\'이\n전국민이 아는 그 사람이라는 걸.',
          speaker: 'narrator',
          style: 'whisper',
          tts: {
            enabled: true,
            hookType: 'cliffhanger',
          },
          effects: {
            unlock: 'memory_first_meeting',
          },
        },
      ],
    },
  ],
};

// ============================================
// EPISODE COLLECTION
// ============================================
export const JUN_EPISODES: Episode[] = [
  JUN_EPISODE_1,
  // EP2, EP3... 추가 예정
];
