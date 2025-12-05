// 공통 광고 인터페이스 정의

export type AdPlatform = 'meta' | 'tiktok' | 'google';

export interface AdCampaignConfig {
  name: string;
  budgetDaily: number;
  startDate?: Date;
  endDate?: Date;
  status?: 'ACTIVE' | 'PAUSED';
}

export interface AdCreativeConfig {
  name: string;
  imageUrl: string;
  headline?: string; // Google/Meta
  message?: string;  // Meta (Primary Text) / TikTok (Text)
  linkUrl: string;
  callToAction?: string; // LEARN_MORE, SHOP_NOW etc.
}

export interface AdExecutionResult {
  platform: AdPlatform;
  success: boolean;
  creativeId?: string;
  adId?: string;
  campaignId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AdInsights {
  adId: string;
  platform: AdPlatform;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number; // Click-Through Rate (%)
  cpc: number; // Cost Per Click
  dateStart: string;
  dateStop: string;
}

// 통합 에러 클래스
export class AdApiError extends Error {
  constructor(
    public platform: AdPlatform,
    message: string,
    public originalError?: any,
    public statusCode?: number
  ) {
    super(`[${platform}] ${message}`);
    this.name = 'AdApiError';
  }
}

// 모든 광고 클라이언트가 구현해야 하는 인터페이스
export interface AdClient {
  platform: AdPlatform;

  /**
   * 이미지 업로드 (소재 등록 전 단계)
   * @returns 업로드된 자산의 식별자 (hash, asset_id 등)
   */
  uploadImage(imageUrl: string): Promise<string>;

  /**
   * 광고 소재(Creative) 생성
   */
  createCreative(config: AdCreativeConfig): Promise<string>;

  /**
   * 캠페인 생성
   */
  createCampaign(config: AdCampaignConfig): Promise<string>;

  /**
   * 광고 그룹(AdSet) 생성 - 플랫폼별 옵션이 다르므로 any 처리하거나 별도 타입 필요
   */
  createAdGroup(campaignId: string, name: string, targeting?: any): Promise<string>;

  /**
   * 최종 광고(Ad) 생성
   */
  createAd(adGroupId: string, creativeId: string, name: string): Promise<string>;

  /**
   * 광고 성과 조회
   */
  getAdInsights(adId: string): Promise<AdInsights>;
}
