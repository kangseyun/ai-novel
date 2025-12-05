/**
 * Session Summarizer
 * 대화 세션 종료 시 요약 생성
 *
 * 역할:
 * 1. 세션의 대화 내용을 분석
 * 2. 주요 토픽 추출
 * 3. 감정 아크 추적
 * 4. 요약 텍스트 생성
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRelationshipManager } from './relationship-manager';

// ============================================
// 타입 정의
// ============================================

export interface SessionMessage {
  role: 'user' | 'persona';
  content: string;
  emotion?: string;
  affectionChange?: number;
  createdAt: Date;
}

export interface SessionSummaryResult {
  summary: string;
  topics: string[];
  emotionalArc: {
    start: string;
    end: string;
    keyMoments: string[];
  };
  affectionStart: number;
  affectionEnd: number;
  messageCount: number;
  duration: number; // minutes
}

export interface EmotionalMoment {
  content: string;
  emotion: string;
  timestamp: Date;
}

// ============================================
// 토픽 패턴 정의
// ============================================

const TOPIC_PATTERNS: { pattern: RegExp; topic: string }[] = [
  { pattern: /일상|오늘|어제|내일/g, topic: '일상 대화' },
  { pattern: /일|직장|회사|학교|수업/g, topic: '학업/직장' },
  { pattern: /취미|게임|음악|영화|드라마/g, topic: '취미/관심사' },
  { pattern: /음식|밥|먹|맛있/g, topic: '음식' },
  { pattern: /여행|놀러|가자|어디/g, topic: '여행/외출' },
  { pattern: /걱정|불안|스트레스|힘들/g, topic: '고민 상담' },
  { pattern: /좋아|사랑|그리워|보고싶/g, topic: '감정 표현' },
  { pattern: /꿈|미래|나중에|언젠가/g, topic: '미래 계획' },
  { pattern: /과거|옛날|어렸을|전에/g, topic: '과거 이야기' },
  { pattern: /친구|가족|부모|형제/g, topic: '인간관계' },
];

// ============================================
// 감정 분류
// ============================================

const EMOTION_KEYWORDS: Record<string, string[]> = {
  happy: ['좋아', '행복', '기뻐', 'ㅋㅋ', 'ㅎㅎ', '웃', '재밌', '신나'],
  sad: ['슬퍼', '우울', '힘들', '아프', '눈물', '속상'],
  angry: ['화나', '짜증', '열받', '싫어', '미워'],
  anxious: ['걱정', '불안', '무서', '두려'],
  loving: ['사랑', '좋아해', '보고싶', '그리워', '소중'],
  neutral: [],
};

// ============================================
// Session Summarizer 클래스
// ============================================

export class SessionSummarizer {
  private supabase: SupabaseClient;
  private useLLM: boolean;

  constructor(useLLM: boolean = false) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    this.supabase = createClient(url, key);
    this.useLLM = useLLM;
  }

  /**
   * 세션 ID로 메시지 조회
   */
  async getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
    const { data } = await this.supabase
      .from('conversation_messages')
      .select('role, content, emotion, affection_change, created_at')
      .eq('session_id', sessionId)
      .order('sequence_number', { ascending: true });

    return (data || []).map(m => ({
      role: m.role as 'user' | 'persona',
      content: m.content,
      emotion: m.emotion,
      affectionChange: m.affection_change,
      createdAt: new Date(m.created_at),
    }));
  }

  /**
   * 세션 요약 생성 (메인 함수)
   */
  async summarizeSession(
    sessionId: string,
    userId: string,
    personaId: string
  ): Promise<SessionSummaryResult | null> {
    const messages = await this.getSessionMessages(sessionId);

    if (messages.length < 3) {
      console.log('[SessionSummarizer] Too few messages to summarize');
      return null;
    }

    // 기본 분석
    const topics = this.extractTopics(messages);
    const emotionalArc = this.analyzeEmotionalArc(messages);
    const { affectionStart, affectionEnd } = this.calculateAffectionChange(messages);

    // 요약 생성
    let summary: string;
    if (this.useLLM && messages.length >= 10) {
      summary = await this.generateLLMSummary(messages, personaId);
    } else {
      summary = this.generateRuleSummary(messages, topics, emotionalArc);
    }

    const result: SessionSummaryResult = {
      summary,
      topics,
      emotionalArc,
      affectionStart,
      affectionEnd,
      messageCount: messages.length,
      duration: this.calculateDuration(messages),
    };

    // RelationshipManager를 통해 저장
    await this.saveToDatabase(userId, personaId, sessionId, result);

    return result;
  }

  /**
   * 토픽 추출
   */
  private extractTopics(messages: SessionMessage[]): string[] {
    const topicCounts = new Map<string, number>();
    const allText = messages.map(m => m.content).join(' ');

    for (const { pattern, topic } of TOPIC_PATTERNS) {
      const matches = allText.match(pattern);
      if (matches && matches.length > 0) {
        topicCounts.set(topic, matches.length);
      }
    }

    // 빈도순 정렬
    const sorted = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    return sorted.length > 0 ? sorted : ['일반 대화'];
  }

  /**
   * 감정 아크 분석
   */
  private analyzeEmotionalArc(messages: SessionMessage[]): {
    start: string;
    end: string;
    keyMoments: string[];
  } {
    if (messages.length === 0) {
      return { start: 'neutral', end: 'neutral', keyMoments: [] };
    }

    // 시작/끝 감정
    const startEmotion = this.detectEmotion(messages.slice(0, 3));
    const endEmotion = this.detectEmotion(messages.slice(-3));

    // 핵심 순간 (감정 변화가 큰 지점)
    const keyMoments: string[] = [];
    const personaMessages = messages.filter(m => m.role === 'persona');

    for (let i = 1; i < personaMessages.length; i++) {
      const prev = personaMessages[i - 1];
      const curr = personaMessages[i];

      if (curr.affectionChange && Math.abs(curr.affectionChange) >= 2) {
        const snippet = curr.content.substring(0, 50);
        keyMoments.push(snippet + (curr.content.length > 50 ? '...' : ''));
      }
    }

    return {
      start: startEmotion,
      end: endEmotion,
      keyMoments: keyMoments.slice(0, 3),
    };
  }

  /**
   * 텍스트에서 감정 탐지
   */
  private detectEmotion(messages: SessionMessage[]): string {
    const text = messages.map(m => m.content).join(' ');

    let maxScore = 0;
    let detectedEmotion = 'neutral';

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      if (keywords.length === 0) continue;

      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score++;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    }

    // 페르소나 메시지에 명시된 감정 우선
    for (const msg of messages) {
      if (msg.role === 'persona' && msg.emotion) {
        return msg.emotion;
      }
    }

    return detectedEmotion;
  }

  /**
   * 호감도 변화 계산
   */
  private calculateAffectionChange(messages: SessionMessage[]): {
    affectionStart: number;
    affectionEnd: number;
  } {
    let totalChange = 0;
    for (const msg of messages) {
      if (msg.affectionChange) {
        totalChange += msg.affectionChange;
      }
    }

    // 시작 호감도는 알 수 없으므로 변화량만 기록
    // 실제 값은 세션 테이블에서 가져와야 함
    return {
      affectionStart: 0, // 나중에 세션 데이터로 채움
      affectionEnd: totalChange,
    };
  }

  /**
   * 대화 시간 계산 (분)
   */
  private calculateDuration(messages: SessionMessage[]): number {
    if (messages.length < 2) return 0;

    const first = messages[0].createdAt.getTime();
    const last = messages[messages.length - 1].createdAt.getTime();

    return Math.round((last - first) / (1000 * 60));
  }

  /**
   * 규칙 기반 요약 생성
   */
  private generateRuleSummary(
    messages: SessionMessage[],
    topics: string[],
    emotionalArc: { start: string; end: string; keyMoments: string[] }
  ): string {
    const topicStr = topics.slice(0, 3).join(', ');
    const msgCount = messages.length;

    let summary = '';

    // 기본 정보
    if (msgCount < 10) {
      summary = `짧은 대화를 나눴다. `;
    } else if (msgCount < 30) {
      summary = `대화를 나눴다. `;
    } else {
      summary = `긴 대화를 나눴다. `;
    }

    // 토픽
    if (topics.length > 0) {
      summary += `주로 ${topicStr}에 대해 이야기했다. `;
    }

    // 감정 변화
    if (emotionalArc.start !== emotionalArc.end) {
      summary += `대화가 진행되면서 분위기가 ${this.emotionToKorean(emotionalArc.start)}에서 ${this.emotionToKorean(emotionalArc.end)}(으)로 바뀌었다.`;
    } else if (emotionalArc.start !== 'neutral') {
      summary += `전체적으로 ${this.emotionToKorean(emotionalArc.start)} 분위기였다.`;
    }

    return summary.trim();
  }

  /**
   * 감정 한글 변환
   */
  private emotionToKorean(emotion: string): string {
    const map: Record<string, string> = {
      happy: '즐거운',
      sad: '슬픈',
      angry: '화난',
      anxious: '불안한',
      loving: '다정한',
      neutral: '평온한',
      excited: '신나는',
      vulnerable: '솔직한',
    };
    return map[emotion] || emotion;
  }

  /**
   * LLM 기반 요약 생성 (현재는 규칙 기반으로 대체)
   * TODO: LLM 요약 기능 추가 시 활성화
   */
  private async generateLLMSummary(
    messages: SessionMessage[],
    _personaId: string
  ): Promise<string> {
    // 현재는 규칙 기반 요약 사용
    // 나중에 LLM API를 통한 요약 기능 추가 가능
    return this.generateRuleSummary(
      messages,
      this.extractTopics(messages),
      this.analyzeEmotionalArc(messages)
    );
  }

  /**
   * DB에 저장
   */
  private async saveToDatabase(
    userId: string,
    personaId: string,
    sessionId: string,
    result: SessionSummaryResult
  ): Promise<void> {
    const manager = getRelationshipManager();

    await manager.saveSessionSummary(
      userId,
      personaId,
      sessionId,
      result.summary,
      {
        topics: result.topics,
        emotionalArc: result.emotionalArc,
        affectionStart: result.affectionStart,
        affectionEnd: result.affectionEnd,
      }
    );
  }

  /**
   * 일일 요약 생성
   */
  async generateDailySummary(
    userId: string,
    personaId: string,
    date: Date = new Date()
  ): Promise<string | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // 해당 날짜의 세션들 조회
    const { data: sessions } = await this.supabase
      .from('conversation_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('persona_id', personaId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    if (!sessions || sessions.length === 0) {
      return null;
    }

    // 각 세션의 요약 조회
    const { data: summaries } = await this.supabase
      .from('conversation_summaries')
      .select('summary, topics')
      .in('session_id', sessions.map(s => s.id))
      .eq('summary_type', 'session');

    if (!summaries || summaries.length === 0) {
      return null;
    }

    // 토픽 집계
    const allTopics = summaries.flatMap((s: { topics: string[] }) => s.topics || []);
    const topicCounts = allTopics.reduce((acc: Record<string, number>, topic: string) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    // 일일 요약 생성
    const dailySummary = `오늘 ${sessions.length}번의 대화를 나눴다. ${topTopics.length > 0 ? `주로 ${topTopics.join(', ')}에 대해 이야기했다.` : ''}`;

    // DB에 저장
    await this.supabase.from('conversation_summaries').insert({
      user_id: userId,
      persona_id: personaId,
      summary_type: 'daily',
      summary: dailySummary,
      topics: topTopics,
      period_start: startOfDay.toISOString(),
      period_end: endOfDay.toISOString(),
    });

    return dailySummary;
  }
}

// ============================================
// 싱글톤 인스턴스
// ============================================

let sessionSummarizerInstance: SessionSummarizer | null = null;

export function getSessionSummarizer(useLLM: boolean = false): SessionSummarizer {
  if (!sessionSummarizerInstance) {
    sessionSummarizerInstance = new SessionSummarizer(useLLM);
  }
  return sessionSummarizerInstance;
}
