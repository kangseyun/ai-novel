/**
 * API Client for Luminovel.ai
 * 프론트엔드에서 백엔드 API를 호출하는 클라이언트
 */

const API_BASE = '/api';

class ApiClient {
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;
  private onAuthError: (() => void) | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getAccessToken(): string | null {
    if (this.accessToken) return this.accessToken;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  }

  /**
   * 인증 에러 발생 시 호출할 콜백 등록
   * (로그아웃 및 로그인 페이지 리다이렉트 처리용)
   */
  setOnAuthError(callback: () => void) {
    this.onAuthError = callback;
  }

  private async tryRefreshToken(): Promise<boolean> {
    // 이미 리프레시 중이면 기존 Promise 반환
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return false;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        if (data.session?.access_token) {
          this.setAccessToken(data.session.access_token);
          localStorage.setItem('refresh_token', data.session.refresh_token);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private handleAuthFailure() {
    this.setAccessToken(null);
    localStorage.removeItem('refresh_token');

    if (this.onAuthError) {
      this.onAuthError();
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    const token = this.getAccessToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    // 401 에러 시 토큰 갱신 시도
    if (response.status === 401 && !isRetry) {
      // refresh 엔드포인트 자체에서 401이면 리프레시 시도하지 않음
      if (endpoint === '/auth/refresh') {
        this.handleAuthFailure();
        throw new ApiError('Session expired', 401);
      }

      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // 토큰 갱신 성공 시 원래 요청 재시도
        return this.request<T>(endpoint, options, true);
      } else {
        // 갱신 실패 시 로그아웃 처리
        this.handleAuthFailure();
        throw new ApiError('Session expired', 401);
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Request failed', response.status);
    }

    return data;
  }

  // ============ Auth API ============
  async oauthLogin(provider: 'google' | 'discord') {
    return this.request<{ url: string }>('/auth/oauth', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setAccessToken(null);
      localStorage.removeItem('refresh_token');
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token');

    const data = await this.request<{
      session: { access_token: string; refresh_token: string };
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    this.setAccessToken(data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);

    return data;
  }

  // ============ User API ============
  async getProfile() {
    return this.request<{
      id: string;
      email: string;
      nickname: string | null;
      profile_image: string | null;
      bio: string | null;
      tokens: number;
      onboarding_completed: boolean;
      subscription: { plan: string; expires_at: string | null };
    }>('/user/profile');
  }

  async updateProfile(data: {
    nickname?: string;
    profile_image?: string;
    bio?: string;
    personality_type?: string;
    communication_style?: string;
    emotional_tendency?: string;
    interests?: string[];
    love_language?: string;
    attachment_style?: string;
  }) {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async completeOnboarding(data: {
    variant: 'a' | 'b' | 'c';
    persona_id: string;
    affection_gained?: number;
    choices_made?: Array<{ scene_id: string; choice_id: string }>;
  }) {
    return this.request('/user/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ Personas API ============
  async getPersonas() {
    return this.request<{
      personas: Array<{
        id: string;
        name: string;
        full_name: string;
        age: number;
        occupation: string;
        image: string;
        color: string;
        teaser_line: string;
        available: boolean;
        episode_count: number;
      }>;
    }>('/personas');
  }

  async getPersonaDetail(personaId: string) {
    return this.request<{
      id: string;
      name: string;
      full_name: string;
      age: number;
      occupation: string;
      public_personality: string;
      private_personality: string;
      sns_profile: { username: string; followers: string; bio: string };
    }>(`/personas/${personaId}`);
  }

  async getEpisodes(personaId: string) {
    return this.request<{
      episodes: Array<{
        id: string;
        title: string;
        premise: string;
        duration_minutes: number;
        is_premium: boolean;
        is_locked: boolean;
        can_unlock: boolean;
        thumbnail: string;
        unlock_requirements?: { min_affection?: number; token_cost?: number };
      }>;
    }>(`/personas/${personaId}/episodes`);
  }

  // ============ Game API ============
  async getGameState(personaId: string) {
    return this.request<{
      persona_id: string;
      affection: number;
      relationship_stage: string;
      completed_episodes: string[];
      unlocked_episodes: string[];
      current_episode: { id: string; scene_id: string; beat_index: number } | null;
      story_flags: Record<string, boolean>;
      last_interaction: string;
    }>(`/game/state/${personaId}`);
  }

  async startEpisode(personaId: string, episodeId: string) {
    return this.request<{
      session_id: string;
      episode: { id: string; title: string };
      initial_scene: {
        id: string;
        setting: { location: string; time: string; mood: string };
      };
    }>('/game/episode/start', {
      method: 'POST',
      body: JSON.stringify({ persona_id: personaId, episode_id: episodeId }),
    });
  }

  async makeChoice(data: {
    session_id: string;
    scene_id?: string;
    beat_id?: string;
    choice_id: string;
    is_premium?: boolean;
  }) {
    return this.request<{
      success: boolean;
      affection_change: number;
      new_affection: number;
      flags_updated: Record<string, boolean>;
      next_beat: {
        id: string;
        type: string;
        speaker: string;
        emotion: string;
        text: string;
        tts_url: string | null;
      };
      stage_changed: { from: string; to: string } | null;
    }>('/game/choice', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeEpisode(sessionId: string, episodeId: string) {
    return this.request<{
      completed: boolean;
      total_affection_gained: number;
      new_affection: number;
      unlocked_items: Array<{ id: string; type: string }>;
      unlocked_episodes: string[];
      stage_changed: { from: string; to: string } | null;
      hack_xp_gained: number;
    }>('/game/episode/complete', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, episode_id: episodeId }),
    });
  }

  async saveGame(personaId: string, slot = 1) {
    return this.request('/game/save', {
      method: 'POST',
      body: JSON.stringify({ persona_id: personaId, slot }),
    });
  }

  async loadGame(personaId: string, slot = 1) {
    return this.request(`/game/load/${personaId}/${slot}`);
  }

  // ============ LLM API ============
  async generateDialogue(data: {
    persona_id: string;
    session_id?: string;
    context: {
      scene_id: string;
      beat_id: string;
      user_choice?: string;
      affection: number;
      relationship_stage: string;
      active_flags?: string[];
      recent_dialogue?: Array<{ speaker: string; text: string }>;
    };
  }) {
    return this.request<{
      dialogue: { text: string; emotion: string; inner_thought: string | null };
      affection_modifier: number;
      suggested_choices: string[];
      tts_priority: string;
    }>('/llm/generate-dialogue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateChoices(data: {
    persona_id: string;
    context: { situation: string; mood?: string; affection?: number };
    choice_count?: number;
  }) {
    return this.request<{
      choices: Array<{ id: string; text: string; tone: string }>;
    }>('/llm/generate-choices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============ Feed API ============
  async getFeed(page = 1, limit = 20) {
    return this.request<{
      posts: Array<{
        id: string;
        type: string;
        persona_id?: string;
        content: Record<string, unknown>;
        likes?: number;
        user_liked?: boolean;
        created_at: string;
      }>;
      next_page: number | null;
    }>(`/feed?page=${page}&limit=${limit}`);
  }

  async createPost(data: { type: string; mood?: string; caption: string; image?: string }) {
    return this.request<{
      post: { id: string; type: string; mood: string; caption: string; created_at: string };
      triggered_events: Array<{
        id: string;
        type: string;
        persona_id: string;
        preview: string;
        delay_seconds: number;
      }>;
    }>('/feed/post', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getEvents() {
    return this.request<{
      events: Array<{
        id: string;
        type: string;
        persona_id: string | null;
        title: string | null;
        preview: string | null;
        read: boolean;
        created_at: string;
      }>;
      unread_count: number;
    }>('/feed/events');
  }

  async markEventRead(eventId: string) {
    return this.request(`/feed/events/${eventId}/read`, {
      method: 'PUT',
    });
  }

  // ============ Payments API ============
  async getTokenPackages() {
    return this.request<{
      packages: Array<{
        id: string;
        tokens: number;
        price: number;
        name: string;
        originalPrice: number;
        discount: number;
      }>;
    }>('/payments/checkout');
  }

  async purchaseTokens(packageId: string) {
    return this.request<{ url: string }>('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ package_id: packageId }),
    });
  }

  // ============ Subscriptions API ============
  async getSubscriptionPlans() {
    return this.request<{
      plans: Array<{
        id: string;
        name: string;
        price: number;
        interval: 'month' | 'year';
        features: string[];
      }>;
    }>('/subscriptions/checkout');
  }

  async subscribeToVIP(planId: string) {
    return this.request<{ url: string }>('/subscriptions/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    });
  }

  async getSubscriptionStatus() {
    return this.request<{
      subscription: {
        plan: string;
        status: string;
        currentPeriodEnd: string;
        cancelAtPeriodEnd: boolean;
      } | null;
      isActive: boolean;
    }>('/subscriptions/manage');
  }

  async cancelSubscription() {
    return this.request<{ success: boolean; message: string }>('/subscriptions/manage', {
      method: 'DELETE',
    });
  }

  async reactivateSubscription() {
    return this.request<{ success: boolean; message: string }>('/subscriptions/manage', {
      method: 'PUT',
    });
  }

  async openBillingPortal() {
    return this.request<{ url: string }>('/subscriptions/portal', {
      method: 'POST',
    });
  }

  // ============ AI Agent API ============
  /**
   * AI 페르소나와 채팅
   */
  async aiChat(data: {
    personaId: string;
    message: string;
    sessionId?: string;
    choiceData?: {
      choiceId: string;
      isPremium: boolean;
      wasPremium: boolean;
    };
  }) {
    return this.request<{
      sessionId: string;
      response: {
        content: string;
        emotion: string;
        innerThought: string | null;
      };
      choices: Array<{
        id: string;
        text: string;
        tone: string;
        isPremium: boolean;
        affectionHint: number;
      }>;
      affectionChange: number;
      tokenBalance: number;
      scenarioTrigger?: {
        shouldStart: boolean;
        scenarioType: 'meeting' | 'date' | 'confession' | 'conflict' | 'intimate' | 'custom';
        scenarioContext: string;
        location?: string;
        transitionMessage?: string;
      };
    }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        personaId: data.personaId,
        message: data.message,
        sessionId: data.sessionId,
        choiceData: data.choiceData,
      }),
    });
  }

  /**
   * AI 세션 조회
   */
  async getAiSession(personaId: string) {
    return this.request<{
      session: {
        id: string;
        personaId: string;
        currentEpisodeId: string | null;
        currentScene: string;
        emotionalState: { mood: string; intensity: number };
        contextSummary: string | null;
        startedAt: string;
        lastMessageAt: string;
      } | null;
      messages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        emotion: string | null;
        innerThought: string | null;
        choicesPresented: Array<{
          id: string;
          text: string;
          isPremium: boolean;
        }> | null;
        choiceSelected: string | null;
        createdAt: string;
      }>;
    }>(`/ai/session?personaId=${personaId}`);
  }

  /**
   * 새 AI 세션 시작
   */
  async startAiSession(personaId: string, episodeId?: string) {
    return this.request<{
      session: {
        id: string;
        personaId: string;
        currentEpisodeId: string | null;
        currentScene: string;
        emotionalState: { mood: string; intensity: number };
        startedAt: string;
      };
    }>('/ai/session', {
      method: 'POST',
      body: JSON.stringify({ personaId, episodeId }),
    });
  }

  /**
   * AI 세션 종료
   */
  async endAiSession(sessionId: string) {
    return this.request<{ success: boolean }>(`/ai/session?sessionId=${sessionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 대화 히스토리 조회
   */
  async getAiHistory(personaId: string, limit = 100) {
    return this.request<{
      messages: Array<{
        id: string;
        sessionId: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        emotion: string | null;
        innerThought: string | null;
        createdAt: string;
      }>;
      totalCount: number;
    }>(`/ai/history?personaId=${personaId}&limit=${limit}`);
  }

  /**
   * 관계 상태 조회
   */
  async getRelationship(personaId: string) {
    return this.request<{
      personaId: string;
      stage: 'stranger' | 'acquaintance' | 'close' | 'intimate' | 'lover';
      affectionLevel: number;
      trustLevel: number;
      intimacyLevel: number;
      totalInteractions: number;
      unlockedMemories: string[];
      relationshipMilestones: string[];
      lastInteractionAt: string | null;
    }>(`/ai/relationship?personaId=${personaId}`);
  }

  /**
   * 대기 중인 이벤트 조회
   */
  async getPendingEvents() {
    return this.request<{
      events: Array<{
        id: string;
        personaId: string;
        type: string;
        scheduledFor: string;
        priority: number;
        persona: {
          name: string;
          display_name: string;
          avatar_url: string;
        };
        preview: string | null;
      }>;
    }>('/ai/events/pending');
  }

  /**
   * 이벤트 트리거 체크
   */
  async checkEventTrigger(personaId: string, actionType?: string, actionData?: Record<string, unknown>) {
    return this.request<{
      triggered: boolean;
      event?: {
        id: string;
        type: string;
        scheduledFor: string;
        priority: number;
      };
    }>('/ai/events/check', {
      method: 'POST',
      body: JSON.stringify({ personaId, actionType, actionData }),
    });
  }

  /**
   * 예약된 이벤트 처리
   */
  async processEvent(eventId: string) {
    return this.request<{
      success: boolean;
      content?: string;
      emotion?: string;
    }>('/ai/events/process', {
      method: 'POST',
      body: JSON.stringify({ eventId }),
    });
  }

  /**
   * 사용자 활동 로깅
   */
  async logActivity(actionType: string, personaId?: string, actionData?: Record<string, unknown>) {
    return this.request<{ success: boolean }>('/ai/activity', {
      method: 'POST',
      body: JSON.stringify({ actionType, personaId, actionData }),
    });
  }

  /**
   * 활동 로그 조회
   */
  async getActivityLog(personaId?: string, limit = 50) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (personaId) params.set('personaId', personaId);

    return this.request<{
      activities: Array<{
        id: string;
        actionType: string;
        personaId: string | null;
        actionData: Record<string, unknown>;
        createdAt: string;
      }>;
    }>(`/ai/activity?${params.toString()}`);
  }

  // ============ DM API ============
  /**
   * DM 대화 목록 조회
   */
  async getDMList() {
    return this.request<{
      conversations: Array<{
        personaId: string;
        personaName: string;
        personaDisplayName: string;
        personaImage: string;
        isVerified: boolean;
        lastMessage: string;
        lastMessageAt: string;
        unreadCount: number;
        isOnline: boolean;
      }>;
    }>('/dm/list');
  }

  // ============ Memory API ============
  /**
   * 기억 페이지 - 모든 페르소나 목록
   */
  async getMemoryList() {
    return this.request<{
      personas: Array<{
        id: string;
        name: string;
        fullName: string;
        role: string;
        image: string;
        affection: number;
        trust: number;
        intimacy: number;
        stage: string;
        storyProgress: number;
        totalStories: number;
        unlockedSecrets: number;
        totalSecrets: number;
        memories: Array<{
          id: string;
          type: string;
          title: string;
          content: string;
          isLocked: boolean;
        }>;
        relationship: string;
        currentArc: string;
        userNickname: string | null;
        personaNickname: string | null;
        totalMessages: number;
        firstInteractionAt: string | null;
        lastInteractionAt: string | null;
      }>;
      stats: {
        totalCharacters: number;
        totalSecrets: number;
        totalStories: number;
      };
    }>('/memory');
  }

  /**
   * 기억 페이지 - 특정 페르소나 상세
   */
  async getMemoryDetail(personaId: string) {
    return this.request<{
      exists: boolean;
      persona?: {
        id: string;
        name: string;
        fullName: string;
        role: string;
        image: string;
      };
      relationship?: {
        stage: string;
        stageLabel: string;
        affection: number;
        trust: number;
        intimacy: number;
        totalMessages: number;
        firstInteractionAt: string | null;
        lastInteractionAt: string | null;
        userNickname: string | null;
        personaNickname: string | null;
      };
      stats?: {
        trust: number;
        intimacy: number;
        mystery: number;
        chemistry: number;
        loyalty: number;
      };
      progress?: {
        storyProgress: number;
        totalStories: number;
        currentArc: string;
        unlockedSecrets: number;
        totalSecrets: number;
      };
      memories?: Array<{
        id: string;
        type: string;
        title: string;
        content: string;
        details: Record<string, unknown>;
        emotionalWeight: number;
        createdAt: string;
        isLocked: boolean;
      }>;
      lockedMemos?: Array<{
        id: string;
        type: string;
        title: string;
        content: string;
        isLocked: boolean;
        unlockCondition: string;
      }>;
    }>(`/memory/${personaId}`);
  }

  /**
   * 기억 추가
   */
  async addMemory(personaId: string, data: {
    memoryType: string;
    summary: string;
    details?: Record<string, unknown>;
    emotionalWeight?: number;
  }) {
    return this.request<{
      success: boolean;
      memory?: {
        id: string;
        type: string;
        title: string;
        content: string;
      };
      duplicate?: boolean;
    }>(`/memory/${personaId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient();
