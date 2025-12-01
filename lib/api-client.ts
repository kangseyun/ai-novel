/**
 * API Client for AI Novel
 * 프론트엔드에서 백엔드 API를 호출하는 클라이언트
 */

const API_BASE = '/api';

class ApiClient {
  private accessToken: string | null = null;

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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
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

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Request failed', response.status);
    }

    return data;
  }

  // ============ Auth API ============
  async register(email: string, password: string, nickname?: string) {
    const data = await this.request<{
      user: { id: string; email: string; nickname: string | null };
      session: { access_token: string; refresh_token: string } | null;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname }),
    });

    if (data.session) {
      this.setAccessToken(data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
    }

    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{
      user: {
        id: string;
        email: string;
        nickname: string | null;
        gems: number;
        onboarding_completed: boolean;
      };
      session: { access_token: string; refresh_token: string };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setAccessToken(data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);

    return data;
  }

  async oauthLogin(provider: 'google' | 'apple') {
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
      gems: number;
      onboarding_completed: boolean;
      subscription: { plan: string; expires_at: string | null };
    }>('/user/profile');
  }

  async updateProfile(data: { nickname?: string; profile_image?: string; bio?: string }) {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async savePersona(data: {
    personality_type?: string;
    communication_style?: string;
    emotional_tendency?: string;
    interests?: string[];
    love_language?: string;
    attachment_style?: string;
  }) {
    return this.request('/user/persona', {
      method: 'POST',
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
        unlock_requirements?: { min_affection?: number; gem_cost?: number };
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
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient();
