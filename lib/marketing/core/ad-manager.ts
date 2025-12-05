import { AdClient, AdPlatform, AdCreativeConfig, AdExecutionResult, AdInsights } from './types';
import { MetaAdsClient } from '../clients/meta-client';
import { TikTokAdsClient } from '../clients/tiktok-client';
import { GoogleAdsClient } from '../clients/google-client';

export class AdManager {
  private clients: Map<AdPlatform, AdClient>;

  constructor() {
    this.clients = new Map();
    this.clients.set('meta', new MetaAdsClient());
    this.clients.set('tiktok', new TikTokAdsClient());
    // Google Ads implementation is partial, uncomment when ready
    // this.clients.set('google', new GoogleAdsClient());
  }

  getClient(platform: AdPlatform): AdClient {
    const client = this.clients.get(platform);
    if (!client) {
      throw new Error(`Unsupported platform: ${platform}`);
    }
    return client;
  }

  /**
   * 통합 광고 소재 업로드
   */
  async uploadCreative(
    platform: AdPlatform,
    config: AdCreativeConfig
  ): Promise<AdExecutionResult> {
    try {
      const client = this.getClient(platform);
      
      console.log(`[AdManager] Starting upload for ${platform}...`);
      
      const creativeId = await client.createCreative(config);
      
      return {
        platform,
        success: true,
        creativeId,
      };
    } catch (error: any) {
      console.error(`[AdManager] Upload failed for ${platform}:`, error);
      return {
        platform,
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * 광고 성과 데이터 동기화
   * 플랫폼에서 데이터를 가져와서 정규화된 포맷으로 반환
   */
  async syncAdInsights(platform: AdPlatform, adId: string): Promise<AdInsights | null> {
    try {
      const client = this.getClient(platform);
      console.log(`[AdManager] Syncing insights for ${platform} ad: ${adId}...`);
      
      const insights = await client.getAdInsights(adId);
      
      // TODO: Save to DB here or let the caller handle persistence
      
      return insights;
    } catch (error: any) {
      console.error(`[AdManager] Sync insights failed for ${platform}:`, error);
      // Don't throw, just return null to allow batch processing to continue
      return null;
    }
  }

  /**
   * (Optional) 캠페인 생성부터 광고 집행까지 원스텝 실행
   */
  async launchAd(
    platform: AdPlatform,
    campaignConfig: any, 
    creativeConfig: AdCreativeConfig
  ): Promise<AdExecutionResult> {
    try {
      const client = this.getClient(platform);
      
      const campaignId = await client.createCampaign(campaignConfig);
      const adGroupId = await client.createAdGroup(campaignId, `${campaignConfig.name} - AdGroup`);
      const creativeId = await client.createCreative(creativeConfig);
      const adId = await client.createAd(adGroupId, creativeId, `${creativeConfig.name} - Ad`);
      
      return {
        platform,
        success: true,
        campaignId,
        creativeId,
        adId,
      };
    } catch (error: any) {
      return {
        platform,
        success: false,
        error: error.message,
      };
    }
  }
}

// 싱글톤 인스턴스
export const adManager = new AdManager();
