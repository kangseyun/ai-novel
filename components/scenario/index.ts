/**
 * Scenario Components
 * 재사용 가능한 시나리오 시스템
 */

// 메인 플레이어 컴포넌트
export { default as ScenarioPlayer } from './ScenarioPlayer';
export type {
  ScenarioPlayerProps,
  ScenarioResult,
  ChoiceRecord,
} from './ScenarioPlayer';

// 래퍼 컴포넌트들
export { default as OnboardingScenarioWrapper } from './OnboardingScenarioWrapper';
export { default as EpisodeScenarioPlayer } from './EpisodeScenarioPlayer';
