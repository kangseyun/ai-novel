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

export const PERSONA_IMAGE_PROMPTS: Record<string, PersonaImagePrompt> = {
  jun: {
    personaId: 'jun',
    personaName: 'Jun',
    basePrompt: 'Korean male K-pop idol, 24 years old, silver blonde hair, flawless skin, sparkling eyes, trendy fashion, perfect skin, soft lighting',
    style: 'professional photography, Instagram aesthetic, high quality, 4k, detailed face',
    negativePrompt: 'ugly, deformed, blurry, low quality, bad anatomy, extra limbs, text, watermark',
  },
  daniel: {
    personaId: 'daniel',
    personaName: 'Daniel Sterling',
    basePrompt: 'Caucasian male CEO, 34 years old, ice blue eyes, sharp jawline, dark hair meticulously styled, wearing bespoke three-piece suit, cold expression',
    style: 'corporate photography, luxury aesthetic, dramatic lighting, cinematic, high quality, 4k',
    negativePrompt: 'ugly, deformed, blurry, low quality, bad anatomy, casual clothes, smiling',
  },
  kael: {
    personaId: 'kael',
    personaName: 'Kaelen Vance',
    basePrompt: 'Mixed Korean-Irish male bodyguard, 29 years old, dark messy hair, scar on eyebrow, muscular build, leather jacket, intense dark eyes, stoic expression',
    style: 'noir photography, moody lighting, urban background, high contrast, cinematic, 4k',
    negativePrompt: 'ugly, deformed, blurry, low quality, bad anatomy, smiling, bright colors',
  },
  adrian: {
    personaId: 'adrian',
    personaName: 'Adrian Cruz',
    basePrompt: 'Latino male pianist, 31 years old, long wavy hair tied back, stubble, soulful brown eyes, artistic hands, unbuttoned shirt, melancholic expression',
    style: 'artistic photography, warm tones, jazz club aesthetic, dramatic lighting, cinematic, 4k',
    negativePrompt: 'ugly, deformed, blurry, low quality, bad anatomy, happy expression, formal wear',
  },
  ren: {
    personaId: 'ren',
    personaName: 'Ren Ito',
    basePrompt: 'Japanese male yakuza boss, 32 years old, sharp fox-like eyes, sleek glasses, hidden tattoos, silk suit or traditional kimono, dangerous smile',
    style: 'luxury photography, dramatic shadows, Japanese aesthetic, mysterious, high quality, 4k',
    negativePrompt: 'ugly, deformed, blurry, low quality, bad anatomy, casual clothes, innocent expression',
  },
};

// Scene-specific prompt additions
export const SCENE_PROMPTS: Record<string, string> = {
  // Jun scenes
  'jun_stage': 'on concert stage, colorful stage lights, crowd in background, performing energetically',
  'jun_practice': 'in dance practice room, mirror wall, casual practice clothes, sweaty, focused',
  'jun_coffee': 'late night, coffee shop, hoodie, tired but cute, warm lighting',
  'jun_selfie': 'close-up selfie angle, playful expression, peace sign, soft natural light',

  // Daniel scenes
  'daniel_office': 'in modern office, floor-to-ceiling windows, Manhattan skyline view, sitting at desk',
  'daniel_night': 'penthouse balcony, night city lights, holding whiskey glass, contemplative',
  'daniel_meeting': 'boardroom setting, power pose, multiple monitors, professional lighting',

  // Kael scenes
  'kael_rain': 'rainy city street at night, neon lights reflection, motorcycle nearby, vigilant stance',
  'kael_motorcycle': 'sitting on black motorcycle, leather gloves, helmet in hand, urban backdrop',
  'kael_night_walk': 'empty street, streetlights, hands in pockets, looking back over shoulder',

  // Adrian scenes
  'adrian_piano': 'at grand piano, jazz club, spotlight, eyes closed while playing',
  'adrian_sheet_music': 'home studio, scattered sheet music, guitar on wall, window light',
  'adrian_old_photo': 'holding old photograph, soft lighting, nostalgic expression, messy apartment',

  // Ren scenes
  'ren_casino': 'VIP casino room, poker chips, dramatic lighting, confident smirk',
  'ren_tea_house': 'traditional Japanese tea house, tatami, elegant posture, pouring tea',
  'ren_city_night': 'Tokyo night scene, neon signs, expensive car, dangerous aura',
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
