-- ============================================
-- 임베딩 시스템 업그레이드
-- text-embedding-3-large 모델 사용 (1536차원으로 압축)
-- pgvector HNSW 인덱스는 2000차원 제한이 있음
-- ============================================

-- 참고: persona_memories.embedding 컬럼은 이미 vector(1536)
-- text-embedding-3-large 모델의 dimensions 파라미터로 1536 출력

-- 1. 기존 뷰/인덱스 삭제 (재생성을 위해)
DROP VIEW IF EXISTS memory_embedding_stats;
DROP INDEX IF EXISTS idx_persona_memories_embedding;

-- 2. 인덱스 재생성 (HNSW - 빠른 검색)
CREATE INDEX idx_persona_memories_embedding
ON persona_memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. 뷰 재생성
CREATE OR REPLACE VIEW memory_embedding_stats AS
SELECT persona_id,
    count(*) AS total_memories,
    count(embedding) AS embedded_memories,
    round((((count(embedding))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS embedding_coverage_pct,
    avg(importance_score) AS avg_importance,
    min(created_at) AS oldest_memory,
    max(created_at) AS newest_memory
FROM persona_memories
WHERE (is_active = true)
GROUP BY persona_id;

-- 4. 시맨틱 검색 함수 업데이트
CREATE OR REPLACE FUNCTION search_memories_semantic(
  p_user_id UUID,
  p_persona_id TEXT,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.7,
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  summary TEXT,
  details JSONB,
  emotional_weight INTEGER,
  importance_score INTEGER,
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id,
    pm.memory_type,
    pm.summary,
    pm.details,
    pm.emotional_weight,
    pm.importance_score,
    1 - (pm.embedding <=> p_query_embedding) AS similarity,
    pm.created_at
  FROM persona_memories pm
  WHERE pm.user_id = p_user_id
    AND pm.persona_id = p_persona_id
    AND pm.is_active = true
    AND pm.embedding IS NOT NULL
    AND 1 - (pm.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY pm.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 하이브리드 검색 함수 업데이트
CREATE OR REPLACE FUNCTION search_memories_hybrid(
  p_user_id UUID,
  p_persona_id TEXT,
  p_query_embedding vector(1536),
  p_keywords TEXT[] DEFAULT NULL,
  p_match_threshold FLOAT DEFAULT 0.5,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  summary TEXT,
  details JSONB,
  emotional_weight INTEGER,
  importance_score INTEGER,
  semantic_score FLOAT,
  keyword_score FLOAT,
  final_score FLOAT,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  v_has_keywords BOOLEAN;
BEGIN
  v_has_keywords := p_keywords IS NOT NULL AND array_length(p_keywords, 1) > 0;

  RETURN QUERY
  SELECT
    pm.id,
    pm.memory_type,
    pm.summary,
    pm.details,
    pm.emotional_weight,
    pm.importance_score,
    CASE
      WHEN pm.embedding IS NOT NULL THEN 1 - (pm.embedding <=> p_query_embedding)
      ELSE 0
    END AS semantic_score,
    CASE
      WHEN v_has_keywords THEN (
        SELECT COUNT(*)::FLOAT / array_length(p_keywords, 1)
        FROM unnest(p_keywords) AS kw
        WHERE pm.searchable_text ILIKE '%' || kw || '%'
      )
      ELSE 0
    END AS keyword_score,
    -- 최종 점수: 시맨틱(50%) + 키워드(30%) + 중요도(20%)
    (
      CASE
        WHEN pm.embedding IS NOT NULL THEN (1 - (pm.embedding <=> p_query_embedding)) * 0.5
        ELSE 0
      END
      +
      CASE
        WHEN v_has_keywords THEN (
          SELECT COUNT(*)::FLOAT / array_length(p_keywords, 1)
          FROM unnest(p_keywords) AS kw
          WHERE pm.searchable_text ILIKE '%' || kw || '%'
        ) * 0.3
        ELSE 0
      END
      +
      (pm.importance_score::FLOAT / 10) * 0.2
    ) AS final_score,
    pm.created_at
  FROM persona_memories pm
  WHERE pm.user_id = p_user_id
    AND pm.persona_id = p_persona_id
    AND pm.is_active = true
    AND (
      -- 시맨틱 매칭 (임베딩이 있는 경우)
      (pm.embedding IS NOT NULL AND 1 - (pm.embedding <=> p_query_embedding) > p_match_threshold)
      OR
      -- 키워드 매칭 (키워드가 있는 경우)
      (v_has_keywords AND EXISTS (
        SELECT 1 FROM unnest(p_keywords) AS kw
        WHERE pm.searchable_text ILIKE '%' || kw || '%'
      ))
    )
  ORDER BY final_score DESC
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 임베딩 배치 업데이트 함수
CREATE OR REPLACE FUNCTION update_memory_embeddings(
  p_embeddings JSONB -- [{id: uuid, embedding: float[]}]
)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_item JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_embeddings)
  LOOP
    UPDATE persona_memories
    SET embedding = (
      SELECT array_agg(x::FLOAT)::vector(1536)
      FROM jsonb_array_elements_text(v_item->'embedding') AS x
    )
    WHERE id = (v_item->>'id')::UUID;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Lore 테이블 추가 (페르소나 설정 정보 벡터화)
CREATE TABLE IF NOT EXISTS persona_lore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id TEXT NOT NULL,
  category TEXT NOT NULL, -- 'background', 'personality', 'relationship', 'world', 'secret'
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  importance_score INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(persona_id, key)
);

-- Lore 인덱스
CREATE INDEX IF NOT EXISTS idx_persona_lore_embedding
ON persona_lore USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_persona_lore_persona
ON persona_lore(persona_id) WHERE is_active = true;

-- 8. Lore 검색 함수
CREATE OR REPLACE FUNCTION search_lore_semantic(
  p_persona_id TEXT,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.6,
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  key TEXT,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pl.id,
    pl.category,
    pl.key,
    pl.content,
    1 - (pl.embedding <=> p_query_embedding) AS similarity
  FROM persona_lore pl
  WHERE pl.persona_id = p_persona_id
    AND pl.is_active = true
    AND pl.embedding IS NOT NULL
    AND 1 - (pl.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY pl.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- 9. 대화 기억 저장용 테이블 (실시간 대화 저장)
CREATE TABLE IF NOT EXISTS conversation_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT NOT NULL,
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  embedding vector(1536),
  importance_score INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 대화 기억 인덱스
CREATE INDEX IF NOT EXISTS idx_conversation_memories_embedding
ON conversation_memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_conversation_memories_user_persona
ON conversation_memories(user_id, persona_id, created_at DESC)
WHERE is_active = true;

-- 10. 대화 기억 검색 함수
CREATE OR REPLACE FUNCTION search_conversation_memories(
  p_user_id UUID,
  p_persona_id TEXT,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.65,
  p_match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.role,
    cm.content,
    1 - (cm.embedding <=> p_query_embedding) AS similarity,
    cm.created_at
  FROM conversation_memories cm
  WHERE cm.user_id = p_user_id
    AND cm.persona_id = p_persona_id
    AND cm.is_active = true
    AND cm.embedding IS NOT NULL
    AND 1 - (cm.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY cm.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql;

-- 11. 통합 검색 함수 (기억 + 대화 + Lore)
CREATE OR REPLACE FUNCTION search_all_context(
  p_user_id UUID,
  p_persona_id TEXT,
  p_query_embedding vector(1536),
  p_match_threshold FLOAT DEFAULT 0.6,
  p_memory_count INT DEFAULT 5,
  p_conversation_count INT DEFAULT 5,
  p_lore_count INT DEFAULT 3
)
RETURNS TABLE (
  source_type TEXT,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
) AS $$
BEGIN
  -- 장기 기억
  RETURN QUERY
  SELECT
    'memory'::TEXT AS source_type,
    pm.summary AS content,
    1 - (pm.embedding <=> p_query_embedding) AS similarity,
    jsonb_build_object(
      'memory_type', pm.memory_type,
      'emotional_weight', pm.emotional_weight,
      'created_at', pm.created_at
    ) AS metadata
  FROM persona_memories pm
  WHERE pm.user_id = p_user_id
    AND pm.persona_id = p_persona_id
    AND pm.is_active = true
    AND pm.embedding IS NOT NULL
    AND 1 - (pm.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY pm.embedding <=> p_query_embedding
  LIMIT p_memory_count;

  -- 대화 기억
  RETURN QUERY
  SELECT
    'conversation'::TEXT AS source_type,
    cm.content,
    1 - (cm.embedding <=> p_query_embedding) AS similarity,
    jsonb_build_object(
      'role', cm.role,
      'created_at', cm.created_at
    ) AS metadata
  FROM conversation_memories cm
  WHERE cm.user_id = p_user_id
    AND cm.persona_id = p_persona_id
    AND cm.is_active = true
    AND cm.embedding IS NOT NULL
    AND 1 - (cm.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY cm.embedding <=> p_query_embedding
  LIMIT p_conversation_count;

  -- Lore
  RETURN QUERY
  SELECT
    'lore'::TEXT AS source_type,
    pl.content,
    1 - (pl.embedding <=> p_query_embedding) AS similarity,
    jsonb_build_object(
      'category', pl.category,
      'key', pl.key
    ) AS metadata
  FROM persona_lore pl
  WHERE pl.persona_id = p_persona_id
    AND pl.is_active = true
    AND pl.embedding IS NOT NULL
    AND 1 - (pl.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY pl.embedding <=> p_query_embedding
  LIMIT p_lore_count;
END;
$$ LANGUAGE plpgsql;
