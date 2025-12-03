import { TutorialSequence } from '@/lib/stores/tutorial-store';

/**
 * 초기 튜토리얼: 회원가입 후 앱 사용법 안내
 * - 피드 둘러보기
 * - DM 보내기
 * - 프로필 확인하기
 */
export const INITIAL_TUTORIAL: TutorialSequence = {
  id: 'initial-tutorial',
  name: '앱 사용법 알아보기',
  steps: [
    {
      id: 'welcome',
      targetSelector: '[data-tutorial="home-feed"]',
      message: '환영해요! 여기는 피드예요. 캐릭터들의 일상을 엿볼 수 있어요.',
      subMessage: '스크롤해서 다양한 게시물을 확인해보세요',
      position: 'bottom',
      advanceOn: 'auto',
      autoDelay: 3500,
      padding: 0,
    },
    {
      id: 'home-intro',
      targetSelector: '[data-tutorial="home-button"]',
      message: '홈 버튼을 누르면 피드로 돌아올 수 있어요',
      position: 'top',
      advanceOn: 'auto',
      autoDelay: 2500,
      padding: 8,
    },
    {
      id: 'dm-intro',
      targetSelector: '[data-tutorial="dm-button"]',
      message: 'DM 버튼을 눌러 캐릭터와 직접 대화해보세요!',
      subMessage: '비밀스러운 이야기가 기다리고 있어요',
      position: 'top',
      advanceOn: 'click',
      padding: 8,
    },
    {
      id: 'profile-intro',
      targetSelector: '[data-tutorial="profile-button"]',
      message: '프로필에서 내 정보와 설정을 관리할 수 있어요',
      position: 'top',
      advanceOn: 'click',
      padding: 8,
    },
  ],
};

/**
 * DM 튜토리얼: DM 화면에서의 기능 안내
 */
export const DM_TUTORIAL: TutorialSequence = {
  id: 'dm-tutorial',
  name: 'DM 사용법',
  steps: [
    {
      id: 'dm-list',
      targetSelector: '[data-tutorial="dm-list"]',
      message: '여기서 대화 중인 캐릭터들을 확인할 수 있어요',
      position: 'bottom',
      advanceOn: 'auto',
      autoDelay: 3000,
      padding: 8,
    },
    {
      id: 'dm-chat',
      targetSelector: '[data-tutorial="dm-chat-input"]',
      message: '메시지를 입력해서 캐릭터와 대화해보세요!',
      subMessage: '캐릭터가 자연스럽게 답변해줄 거예요',
      position: 'top',
      advanceOn: 'click',
      padding: 8,
    },
  ],
};

/**
 * 시나리오 튜토리얼: 시나리오 플레이 방법 안내
 */
export const SCENARIO_TUTORIAL: TutorialSequence = {
  id: 'scenario-tutorial',
  name: '시나리오 플레이',
  steps: [
    {
      id: 'scenario-text',
      targetSelector: '[data-tutorial="scenario-text"]',
      message: '화면을 탭하면 스토리가 진행돼요',
      position: 'bottom',
      advanceOn: 'auto',
      autoDelay: 3000,
      padding: 20,
    },
    {
      id: 'scenario-choices',
      targetSelector: '[data-tutorial="scenario-choices"]',
      message: '선택지가 나타나면 하나를 골라주세요',
      subMessage: '선택에 따라 스토리가 달라져요!',
      position: 'top',
      advanceOn: 'click',
      padding: 12,
    },
  ],
};

/**
 * 모든 튜토리얼 목록
 */
export const ALL_TUTORIALS: TutorialSequence[] = [
  INITIAL_TUTORIAL,
  DM_TUTORIAL,
  SCENARIO_TUTORIAL,
];

/**
 * 튜토리얼 ID로 찾기
 */
export function getTutorialById(id: string): TutorialSequence | undefined {
  return ALL_TUTORIALS.find((t) => t.id === id);
}
