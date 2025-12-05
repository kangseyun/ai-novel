import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import { AdClient, AdPlatform, AdCampaignConfig, AdCreativeConfig, AdApiError, AdInsights } from '../core/types';

interface TikTokConfig {
  accessToken: string;
  advertiserId: string;
  appId?: string;
}

export class TikTokAdsClient implements AdClient {
  platform: AdPlatform = 'tiktok';
  private config: TikTokConfig;
  private http: AxiosInstance;
  private baseUrl = 'https://business-api.tiktok.com/open_api/v1.3';

  constructor(config?: Partial<TikTokConfig>) {
    this.config = {
      accessToken: config?.accessToken || process.env.TIKTOK_ACCESS_TOKEN || '',
      advertiserId: config?.advertiserId || process.env.TIKTOK_ADVERTISER_ID || '',
      appId: config?.appId || process.env.TIKTOK_APP_ID || '',
    };

    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Access-Token': this.config.accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    axiosRetry(this.http, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 || // Rate Limit
          error.response?.status === 500    // Server Error
        );
      },
    });
  }

  private handleError(error: any, action: string): never {
    const message = error.response?.data?.message || error.message;
    const code = error.response?.data?.code || error.response?.status;
    console.error(`[TikTok Client] ${action} Failed:`, message, `(Code: ${code})`);
    throw new AdApiError('tiktok', `${action} failed: ${message}`, error, code);
  }

  async uploadImage(imageUrl: string): Promise<string> {
    try {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      // TikTok Image Upload Logic
      return 'tiktok_image_id_mock_123';
    } catch (error) {
      return this.handleError(error, 'Upload Image');
    }
  }

  async createCreative(config: AdCreativeConfig): Promise<string> {
    try {
      const imageId = await this.uploadImage(config.imageUrl);
      return JSON.stringify({
        image_ids: [imageId],
        text: config.message,
        ad_name: config.name,
        call_to_action: config.callToAction || 'DOWNLOAD_NOW',
      });
    } catch (error) {
      return this.handleError(error, 'Create Creative Spec');
    }
  }

  async createCampaign(config: AdCampaignConfig): Promise<string> {
    try {
      // POST /campaign/create/
      return 'tiktok_campaign_id_mock_999';
    } catch (error) {
      return this.handleError(error, 'Create Campaign');
    }
  }

  async createAdGroup(campaignId: string, name: string, targeting?: any): Promise<string> {
    try {
      // POST /adgroup/create/
      return 'tiktok_adgroup_id_mock_888';
    } catch (error) {
      return this.handleError(error, 'Create AdGroup');
    }
  }

  async createAd(adGroupId: string, creativeId: string, name: string): Promise<string> {
    try {
      // POST /ad/create/
      return 'tiktok_ad_id_mock_777';
    } catch (error) {
      return this.handleError(error, 'Create Ad');
    }
  }

  async getAdInsights(adId: string): Promise<AdInsights> {
    try {
      // GET /report/integrated/get/
      const params = {
        advertiser_id: this.config.advertiserId,
        report_type: 'BASIC',
        data_level: 'AUCTION_AD',
        dimensions: ['ad_id', 'stat_time_day'],
        metrics: ['impressions', 'clicks', 'spend', 'ctr', 'cpc'],
        filters: [{ field_name: 'ad_ids', filter_type: 'IN', filter_value: [adId] }],
        start_date: '2023-01-01',
        end_date: '2023-01-02',
      };

      // const response = await this.http.get('/report/integrated/get/', { params });
      
      // Mocking Data
      const mockData = {
        impressions: Math.floor(Math.random() * 5000),
        clicks: Math.floor(Math.random() * 200),
        spend: Math.floor(Math.random() * 50000),
        ctr: Math.random() * 2,
        cpc: Math.floor(Math.random() * 300),
      };

      return {
        adId,
        platform: 'tiktok',
        impressions: mockData.impressions,
        clicks: mockData.clicks,
        spend: mockData.spend,
        ctr: mockData.ctr,
        cpc: mockData.cpc,
        dateStart: params.start_date,
        dateStop: params.end_date,
      };
    } catch (error) {
      return this.handleError(error, 'Get Ad Insights');
    }
  }
}
