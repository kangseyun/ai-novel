/**
 * Kling AI API Client
 * 이미지/비디오 생성을 위한 Kling AI API 클라이언트
 */

const KLING_API_BASE = 'https://api.klingai.com';

// ============================================
// Types
// ============================================

export interface KlingImageGenerationRequest {
  model_name?: 'kling-v1' | 'kling-v1-5' | 'kling-v2' | 'kling-v2-new' | 'kling-v2-1';
  prompt: string;
  negative_prompt?: string;
  image?: string; // Base64 or URL for reference image
  image_reference?: 'subject' | 'face';
  image_fidelity?: number; // 0-1
  human_fidelity?: number; // 0-1
  resolution?: '1k' | '2k';
  n?: number; // 1-9
  aspect_ratio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';
  callback_url?: string;
}

export interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: 'submitted' | 'processing' | 'succeed' | 'failed';
    task_status_msg?: string;
    created_at: number;
    updated_at: number;
    task_result?: {
      images: Array<{
        index: number;
        url: string;
      }>;
    };
  };
}

export interface PersonaImagePrompt {
  personaId: string;
  personaName: string;
  basePrompt: string;
  style: string;
  negativePrompt: string;
}

// ============================================
// Persona Image Prompts
// ============================================

// Per-persona image prompts. Keys are persona IDs (LUMIN members + legacy
// premium personas like daniel). Adding a new persona requires adding an
// entry here for image generation to work.
// LUMIN — 7-member K-pop boy group, original IP. Descriptors track docs/LUMIN.md.
const SHARED_NEGATIVE = 'ugly, deformed, blurry, low quality, bad anatomy, extra limbs, text, watermark, nsfw, sexual content';
const SHARED_STYLE = 'professional K-pop idol photography, Korean idol aesthetic, soft cinematic lighting, glossy magazine cover quality, high quality, 4k, detailed face';

export const PERSONA_IMAGE_PROMPTS: Record<string, PersonaImagePrompt> = {
  haeon: {
    personaId: 'haeon',
    personaName: 'Haeon',
    basePrompt: 'Korean male K-pop idol, 26 years old, leader, main vocal, warm-toned soft features, gentle smile, oversized cream cardigan, golden hour lighting, warm gold accent color',
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
  },
  kael: {
    personaId: 'kael',
    personaName: 'Kael',
    basePrompt: 'Korean male K-pop idol, 24 years old, main dancer / visual, sharp eyes, undercut hairstyle, monochrome wardrobe, cool stage lighting, ice blue accent color, composed expression',
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
  },
  ren: {
    personaId: 'ren',
    personaName: 'Ren',
    basePrompt: 'Korean-Japanese male K-pop idol, 23 years old, main rapper, playful expression, streetwear styling with coral accents, vibrant studio lighting',
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
  },
  jun: {
    personaId: 'jun',
    personaName: 'Jun',
    basePrompt: 'Korean male K-pop idol, 22 years old, lead vocal, soft features, late-night casual hoodie, warm coffee-shop lighting, gentle smile',
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
  },
  adrian: {
    personaId: 'adrian',
    personaName: 'Adrian',
    basePrompt: 'Korean male K-pop idol, 25 years old, sub vocal / producer, headphones around neck, calm studio lighting, focused but warm expression',
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
  },
  sol: {
    personaId: 'sol',
    personaName: 'Sol',
    basePrompt: 'Korean male K-pop idol, 20 years old, youngest, bright cheerful smile, pastel pink and yellow accents, playful soft lighting',
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
  },
  noa: {
    personaId: 'noa',
    personaName: 'Noa',
    basePrompt: 'Korean-American male K-pop idol, 23 years old, sub rapper / English-speaker, modern minimalist styling, mint green accent, bilingual cosmopolitan vibe',
    style: SHARED_STYLE,
    negativePrompt: SHARED_NEGATIVE,
  },
};

// Scene-specific prompt additions — all clean, all K-pop idol contexts
export const SCENE_PROMPTS: Record<string, string> = {
  // Haeon (leader, warm gold)
  haeon_stage: 'on concert stage, warm gold spotlight, microphone in hand, leading the group',
  haeon_practice: 'late-night practice room, oversized cardigan, gentle smile, soft warm lighting',
  haeon_coffee: 'warm cafe interior, holding ceramic cup, candid laugh, golden hour light',

  // Kael (main dancer, ice blue)
  kael_stage: 'concert stage, sharp choreography pose, ice blue stage lighting',
  kael_practice: 'pre-dawn dance studio, mirror wall, monochrome practice fit, focused expression',
  kael_backstage: 'backstage corridor, leaning against wall, cool composed look',

  // Ren (main rapper, coral)
  ren_studio: 'recording studio, headphones on, writing lyrics, coral neon accent',
  ren_freestyle: 'rooftop sunset, mid-rap pose, streetwear, energetic vibe',
  ren_groupie: 'green room, joking with members offscreen, playful peace sign',

  // Jun (lead vocal)
  jun_stage: 'concert stage, vocal performance, single spotlight, emotional expression',
  jun_coffee: 'late-night coffee shop, hoodie, tired but warm smile',
  jun_selfie: 'close-up selfie angle, playful expression, peace sign, soft natural light',

  // Adrian (producer / sub vocal)
  adrian_studio: 'home producing studio, monitor speakers, calm focused face, headphones around neck',
  adrian_piano: 'sitting at upright piano, soft window light, sketching melody',
  adrian_concert: 'concert stage piano section, single warm spotlight',

  // Sol (maknae, pastel)
  sol_dance: 'practice room, playful dance pose, pastel pink and yellow lighting',
  sol_selfie: 'fish-eye selfie, bright cheerful smile, plush toy in frame',
  sol_arcade: 'retro arcade neon glow, holding game controller, laughing',

  // Noa (bilingual, mint)
  noa_studio: 'sleek modern studio, mint green light accent, headphones, smiling',
  noa_airport: 'airport gate at sunrise, casual minimalist styling, suitcase',
  noa_interview: 'interview set, bilingual subtitle screen behind, warm laugh',
};

// ============================================
// Kling AI Client
// ============================================

export class KlingAIClient {
  private accessKey: string;
  private secretKey: string;

  constructor(accessKey?: string, secretKey?: string) {
    this.accessKey = accessKey || process.env.KLING_ACCESS_KEY || '';
    this.secretKey = secretKey || process.env.KLING_SECRET_KEY || '';
  }

  /**
   * JWT 토큰 생성 (Kling AI 인증용)
   */
  private async generateToken(): Promise<string> {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.accessKey,
      exp: now + 1800, // 30분 유효
      nbf: now - 5,
    };

    // Base64URL 인코딩
    const base64UrlEncode = (obj: object) => {
      const json = JSON.stringify(obj);
      const base64 = Buffer.from(json).toString('base64');
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const headerEncoded = base64UrlEncode(header);
    const payloadEncoded = base64UrlEncode(payload);

    // HMAC-SHA256 서명
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  /**
   * 이미지 생성 태스크 생성
   */
  async createImageTask(request: KlingImageGenerationRequest): Promise<KlingTaskResponse> {
    const token = await this.generateToken();

    const response = await fetch(`${KLING_API_BASE}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kling API error: ${error}`);
    }

    return response.json();
  }

  /**
   * 태스크 상태 조회
   */
  async getTaskStatus(taskId: string): Promise<KlingTaskResponse> {
    const token = await this.generateToken();

    const response = await fetch(`${KLING_API_BASE}/v1/images/generations/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Kling API error: ${error}`);
    }

    return response.json();
  }

  /**
   * 태스크 완료까지 폴링 (최대 5분)
   */
  async waitForCompletion(taskId: string, maxWaitMs = 300000): Promise<KlingTaskResponse> {
    const startTime = Date.now();
    const pollInterval = 3000; // 3초마다 확인

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getTaskStatus(taskId);

      if (status.data.task_status === 'succeed') {
        return status;
      }

      if (status.data.task_status === 'failed') {
        throw new Error(`Image generation failed: ${status.data.task_status_msg}`);
      }

      // 대기
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Image generation timed out');
  }

  /**
   * 페르소나 피드 이미지 생성
   */
  async generatePersonaFeedImage(
    personaId: string,
    sceneKey: string,
    additionalPrompt?: string
  ): Promise<string[]> {
    const personaPrompt = PERSONA_IMAGE_PROMPTS[personaId];
    if (!personaPrompt) {
      throw new Error(`Unknown persona: ${personaId}`);
    }

    const scenePrompt = SCENE_PROMPTS[sceneKey] || '';

    // 전체 프롬프트 조합
    const fullPrompt = [
      personaPrompt.basePrompt,
      scenePrompt,
      additionalPrompt,
      personaPrompt.style,
    ].filter(Boolean).join(', ');

    // 이미지 생성 요청
    const task = await this.createImageTask({
      model_name: 'kling-v2-1',
      prompt: fullPrompt,
      negative_prompt: personaPrompt.negativePrompt,
      aspect_ratio: '1:1', // Instagram 스타일
      resolution: '1k',
      n: 1,
    });

    // 완료 대기
    const result = await this.waitForCompletion(task.data.task_id);

    // 이미지 URL 반환
    return result.data.task_result?.images.map(img => img.url) || [];
  }

  /**
   * 일괄 피드 이미지 생성
   */
  async generateBatchFeedImages(
    requests: Array<{ personaId: string; sceneKey: string; additionalPrompt?: string }>
  ): Promise<Array<{ personaId: string; sceneKey: string; urls: string[] }>> {
    const results = [];

    for (const req of requests) {
      try {
        const urls = await this.generatePersonaFeedImage(
          req.personaId,
          req.sceneKey,
          req.additionalPrompt
        );
        results.push({
          personaId: req.personaId,
          sceneKey: req.sceneKey,
          urls,
        });
      } catch (error) {
        console.error(`Failed to generate image for ${req.personaId}/${req.sceneKey}:`, error);
        results.push({
          personaId: req.personaId,
          sceneKey: req.sceneKey,
          urls: [],
        });
      }
    }

    return results;
  }
}

// ============================================
// Singleton Instance
// ============================================

let klingClientInstance: KlingAIClient | null = null;

export function getKlingAIClient(): KlingAIClient {
  if (!klingClientInstance) {
    klingClientInstance = new KlingAIClient();
  }
  return klingClientInstance;
}
