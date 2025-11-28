/**
 * ElevenLabs TTS Integration
 *
 * Hook 포인트 (임팩트 있는 순간)에서만 TTS 사용:
 * - 첫 만남의 핵심 대사
 * - 고백 순간
 * - 클리프행어
 * - 감정 폭발 장면
 */

export interface TTSConfig {
  voiceId: string;
  stability?: number;      // 0-1: 낮을수록 더 다양한 표현
  similarityBoost?: number; // 0-1: 높을수록 원본 목소리와 유사
  style?: number;          // 0-1: 스타일 강조
}

// Jun 캐릭터 음성 설정
export const JUN_VOICE_CONFIG: TTSConfig = {
  voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_JUN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam voice as default
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.6,
};

// TTS가 필요한 Hook 포인트 타입
export type TTSHookType =
  | 'first_meeting'      // 첫 만남
  | 'confession'         // 고백
  | 'cliffhanger'        // 클리프행어
  | 'emotional_peak'     // 감정 폭발
  | 'whisper'            // 속삭임 (새벽 통화)
  | 'goodbye';           // 이별

interface TTSRequest {
  text: string;
  hookType: TTSHookType;
  voiceConfig?: TTSConfig;
}

interface TTSResponse {
  audioUrl: string;
  duration: number;
}

class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';
  private audioCache: Map<string, string> = new Map();

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
  }

  /**
   * 텍스트를 음성으로 변환
   */
  async textToSpeech(request: TTSRequest): Promise<TTSResponse | null> {
    const { text, hookType, voiceConfig = JUN_VOICE_CONFIG } = request;

    // 캐시 확인
    const cacheKey = `${voiceConfig.voiceId}-${text}`;
    if (this.audioCache.has(cacheKey)) {
      return {
        audioUrl: this.audioCache.get(cacheKey)!,
        duration: this.estimateDuration(text),
      };
    }

    // API 키 없으면 null 반환 (개발 환경)
    if (!this.apiKey) {
      console.warn('[ElevenLabs] API key not configured');
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceConfig.voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2', // 한국어 지원
            voice_settings: {
              stability: voiceConfig.stability,
              similarity_boost: voiceConfig.similarityBoost,
              style: voiceConfig.style,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // 캐시 저장
      this.audioCache.set(cacheKey, audioUrl);

      return {
        audioUrl,
        duration: this.estimateDuration(text),
      };
    } catch (error) {
      console.error('[ElevenLabs] TTS Error:', error);
      return null;
    }
  }

  /**
   * Hook 타입에 따른 음성 스타일 조정
   */
  getVoiceConfigForHook(hookType: TTSHookType): TTSConfig {
    const baseConfig = { ...JUN_VOICE_CONFIG };

    switch (hookType) {
      case 'whisper':
        // 속삭임: 더 부드럽고 안정적
        return { ...baseConfig, stability: 0.7, style: 0.3 };

      case 'emotional_peak':
        // 감정 폭발: 더 다양하고 강렬
        return { ...baseConfig, stability: 0.3, style: 0.9 };

      case 'confession':
        // 고백: 진심 어린, 약간 떨리는
        return { ...baseConfig, stability: 0.4, style: 0.7 };

      case 'cliffhanger':
        // 클리프행어: 긴장감
        return { ...baseConfig, stability: 0.5, style: 0.8 };

      default:
        return baseConfig;
    }
  }

  /**
   * 텍스트 길이 기반 예상 재생 시간 (초)
   */
  private estimateDuration(text: string): number {
    // 한국어 기준 약 4-5자/초
    const charPerSecond = 4.5;
    return Math.max(1, text.length / charPerSecond);
  }

  /**
   * 캐시 클리어
   */
  clearCache() {
    this.audioCache.forEach((url) => URL.revokeObjectURL(url));
    this.audioCache.clear();
  }
}

export const elevenLabsService = new ElevenLabsService();

/**
 * React Hook: TTS 재생
 */
export function useTTS() {
  const playTTS = async (text: string, hookType: TTSHookType): Promise<boolean> => {
    const config = elevenLabsService.getVoiceConfigForHook(hookType);
    const result = await elevenLabsService.textToSpeech({
      text,
      hookType,
      voiceConfig: config,
    });

    if (result) {
      const audio = new Audio(result.audioUrl);
      await audio.play();
      return true;
    }
    return false;
  };

  return { playTTS };
}
