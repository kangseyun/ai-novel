/**
 * Embedding Service
 * 텍스트 임베딩 생성 서비스 (OpenAI/OpenRouter)
 */

// OpenAI 임베딩 모델 (text-embedding-3-large는 더 높은 품질)
// pgvector HNSW/IVFFlat은 2000차원 제한이 있어 1536차원으로 설정
const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 1536;

// 배치 처리 설정
const BATCH_SIZE = 50;  // 한 번에 임베딩할 최대 텍스트 수
const MAX_TEXT_LENGTH = 8000;  // 최대 텍스트 길이 (토큰 제한 고려)

interface EmbeddingResult {
  text: string;
  embedding: number[];
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class EmbeddingService {
  private apiKey: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    // OpenRouter 또는 OpenAI API 키 사용
    this.apiKey = options?.apiKey
      || process.env.OPENAI_API_KEY
      || process.env.OPENROUTER_API_KEY
      || '';

    // OpenRouter 사용 시 별도 URL, 그렇지 않으면 OpenAI
    this.baseUrl = options?.baseUrl
      || (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1');
  }

  /**
   * 단일 텍스트 임베딩 생성
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    const results = await this.generateEmbeddings([text]);
    return results[0]?.embedding || null;
  }

  /**
   * 배치 텍스트 임베딩 생성
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];

    // 텍스트 전처리 (길이 제한)
    const processedTexts = texts.map(t =>
      t.length > MAX_TEXT_LENGTH ? t.substring(0, MAX_TEXT_LENGTH) : t
    );

    const results: EmbeddingResult[] = [];

    // 배치 처리
    for (let i = 0; i < processedTexts.length; i += BATCH_SIZE) {
      const batch = processedTexts.slice(i, i + BATCH_SIZE);
      const originalBatch = texts.slice(i, i + BATCH_SIZE);

      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            // OpenRouter 특정 헤더
            ...(this.baseUrl.includes('openrouter') ? {
              'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            } : {}),
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: batch,
            dimensions: EMBEDDING_DIMENSIONS,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('[EmbeddingService] API error:', error);
          // 실패한 배치는 null로 채움
          batch.forEach((_, idx) => {
            results.push({ text: originalBatch[idx], embedding: [] });
          });
          continue;
        }

        const data: OpenAIEmbeddingResponse = await response.json();

        // 결과 매핑
        for (const item of data.data) {
          results.push({
            text: originalBatch[item.index],
            embedding: item.embedding,
          });
        }
      } catch (error) {
        console.error('[EmbeddingService] Failed to generate embeddings:', error);
        // 실패한 배치는 빈 배열로 채움
        batch.forEach((_, idx) => {
          results.push({ text: originalBatch[idx], embedding: [] });
        });
      }
    }

    return results;
  }

  /**
   * 두 임베딩 간 코사인 유사도 계산
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * 쿼리와 가장 유사한 텍스트 찾기 (로컬 계산)
   */
  findMostSimilar(
    queryEmbedding: number[],
    candidates: Array<{ text: string; embedding: number[] }>,
    topK: number = 5
  ): Array<{ text: string; similarity: number }> {
    const scored = candidates
      .filter(c => c.embedding && c.embedding.length > 0)
      .map(c => ({
        text: c.text,
        similarity: this.cosineSimilarity(queryEmbedding, c.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, topK);
  }
}

// 싱글톤 인스턴스
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}

export { EMBEDDING_DIMENSIONS };
