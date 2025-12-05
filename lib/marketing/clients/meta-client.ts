import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { AdClient, AdPlatform, AdCampaignConfig, AdCreativeConfig, AdApiError, AdInsights } from '../core/types';

interface MetaConfig {
  accessToken: string;
  adAccountId: string;
  pageId: string;
}

export class MetaAdsClient implements AdClient {
  platform: AdPlatform = 'meta';
  private config: MetaConfig;
  private http: AxiosInstance;
  private baseUrl = 'https://graph.facebook.com/v19.0';

  constructor(config?: Partial<MetaConfig>) {
    this.config = {
      accessToken: config?.accessToken || process.env.META_ACCESS_TOKEN || '',
      adAccountId: config?.adAccountId || process.env.META_AD_ACCOUNT_ID || '',
      pageId: config?.pageId || process.env.META_PAGE_ID || '',
    };

    // Axios 인스턴스 생성 및 재시도 로직 설정
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30초 타임아웃
    });

    axiosRetry(this.http, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay, // 1s, 2s, 4s...
      retryCondition: (error) => {
        // 네트워크 에러거나 5xx 에러, 또는 Rate Limit(429)일 경우 재시도
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429
        );
      },
    });
  }

  private handleError(error: any, action: string): never {
    const message = error.response?.data?.error?.message || error.message;
    const code = error.response?.status;
    console.error(`[Meta Client] ${action} Failed:`, message);
    throw new AdApiError('meta', `${action} failed: ${message}`, error, code);
  }

  async uploadImage(imageUrl: string): Promise<string> {
    try {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      // 실제 구현 시 FormData 사용하여 /act_{id}/adimages 엔드포인트 호출
      console.log('[Meta Client] Uploading image bytes...');
      
      // Mocking successful hash
      return 'dummy_image_hash_' + Date.now();
    } catch (error) {
      return this.handleError(error, 'Upload Image');
    }
  }

  async createCreative(config: AdCreativeConfig): Promise<string> {
    try {
      const imageHash = await this.uploadImage(config.imageUrl);

      const url = `/act_${this.config.adAccountId}/adcreatives`;
      const payload = {
        name: config.name,
        object_story_spec: {
          page_id: this.config.pageId,
          link_data: {
            image_hash: imageHash,
            link: config.linkUrl,
            message: config.message,
            name: config.headline,
            call_to_action: {
              type: config.callToAction || 'LEARN_MORE',
            },
          },
        },
        degrees_of_freedom_spec: {
          creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_IN' } }
        },
        access_token: this.config.accessToken,
      };

      // const response = await this.http.post(url, payload);
      // return response.data.id;
      console.log('[Meta Client] Creating creative:', payload.name);
      return 'meta_creative_id_' + Date.now();
    } catch (error) {
      return this.handleError(error, 'Create Creative');
    }
  }

  async createCampaign(config: AdCampaignConfig): Promise<string> {
    try {
      const url = `/act_${this.config.adAccountId}/campaigns`;
      const payload = {
        name: config.name,
        objective: 'OUTCOME_TRAFFIC',
        status: config.status || 'PAUSED',
        special_ad_categories: [],
        access_token: this.config.accessToken,
      };
      
      // const response = await this.http.post(url, payload);
      // return response.data.id;
      return 'meta_campaign_id_' + Date.now();
    } catch (error) {
      return this.handleError(error, 'Create Campaign');
    }
  }

  async createAdGroup(campaignId: string, name: string, targeting?: any): Promise<string> {
    try {
      // Mocking AdSet creation
      return 'meta_adset_id_' + Date.now();
    } catch (error) {
      return this.handleError(error, 'Create AdGroup');
    }
  }

  async createAd(adGroupId: string, creativeId: string, name: string): Promise<string> {
    try {
      const url = `/act_${this.config.adAccountId}/ads`;
      const payload = {
        name: name,
        adset_id: adGroupId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
        access_token: this.config.accessToken,
      };

      // const response = await this.http.post(url, payload);
      // return response.data.id;
      return 'meta_ad_id_' + Date.now();
    } catch (error) {
      return this.handleError(error, 'Create Ad');
    }
  }

  async getAdInsights(adId: string): Promise<AdInsights> {
    try {
      const url = `/${adId}/insights`;
      const params = {
        fields: 'impressions,clicks,spend,ctr,cpc,date_start,date_stop',
        access_token: this.config.accessToken,
      };

      // const response = await this.http.get(url, { params });
      // const data = response.data.data[0];
      
      // Mocking Data for Prototype
      const mockData = {
        impressions: Math.floor(Math.random() * 5000),
        clicks: Math.floor(Math.random() * 200),
        spend: Math.floor(Math.random() * 50000),
        ctr: Math.random() * 2,
        cpc: Math.floor(Math.random() * 300),
        date_start: '2023-01-01',
        date_stop: '2023-01-02',
      };

      return {
        adId,
        platform: 'meta',
        impressions: mockData.impressions,
        clicks: mockData.clicks,
        spend: mockData.spend,
        ctr: mockData.ctr,
        cpc: mockData.cpc,
        dateStart: mockData.date_start,
        dateStop: mockData.date_stop,
      };
    } catch (error) {
      return this.handleError(error, 'Get Ad Insights');
    }
  }
}
