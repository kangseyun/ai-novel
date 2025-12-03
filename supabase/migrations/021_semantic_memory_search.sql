-- ============================================
-- 시맨틱 메모리 검색 시스템 (pgvector)
-- ============================================
-- 목적: 과거 기억을 의미 기반으로 검색하여 장기 기억력 향상
-- 예: "우리 3달 전에 갔던 카페" 언급 시 관련 기억 찾기

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 임베딩 컬럼 추가
ALTER TABLE persona_memories
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. 임베딩용 텍스트 컬럼 (summary + details 결합)
ALTER TABLE persona_memories
ADD COLUMN IF NOT EXISTS searchable_text TEXT;

-- 4. 중요도 및 활성 상태 컬럼 (없으면 추가)
ALTER TABLE persona_memories
ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 5;

ALTER TABLE persona_memories
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE persona_memories
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'dm';

ALTER TABLE persona_memories
ADD COLUMN IF NOT EXISTS source_id TEXT;

ALTER TABLE persona_memories
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 5. searchable_text 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_memory_searchable_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.searchable_text = COALESCE(NEW.summary, '') || ' ' ||
                        COALESCE(NEW.details::text, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_memory_searchable_text ON persona_memories;
CREATE TRIGGER trigger_update_memory_searchable_text
  BEFORE INSERT OR UPDATE ON persona_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_searchable_text();

-- 6. 기존 데이터 searchable_text 업데이트
UPDATE persona_memories
SET searchable_text = COALESCE(summary, '') || ' ' || COALESCE(details::text, '')
WHERE searchable_text IS NULL;

-- 7. 시맨틱 검색 함수 (코사인 유사도)
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

-- 8. 하이브리드 검색 함수 (시맨틱 + 키워드 + 중요도 가중치)
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

-- 9. 메모리 참조 카운트 증가 함수
CREATE OR REPLACE FUNCTION increment_memory_reference(p_memory_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE persona_memories
  SET
    reference_count = COALESCE(reference_count, 0) + 1,
    last_referenced_at = NOW()
  WHERE id = p_memory_id;
END;
$$ LANGUAGE plpgsql;

-- 10. 인덱스 생성 (HNSW - 빠른 근사 최근접 이웃 검색)
-- HNSW는 IVFFlat보다 빠르고 정확도가 높음
CREATE INDEX IF NOT EXISTS idx_persona_memories_embedding
ON persona_memories USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 키워드 검색용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_persona_memories_searchable_text
ON persona_memories USING gin (to_tsvector('simple', searchable_text));

-- 복합 인덱스 (자주 사용되는 필터 조합)
CREATE INDEX IF NOT EXISTS idx_persona_memories_user_persona_active
ON persona_memories(user_id, persona_id, is_active)
WHERE is_active = true;

-- 11. 임베딩 배치 업데이트 함수 (외부 임베딩 서비스 결과 저장용)
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

-- 12. 통계 뷰 (디버깅/모니터링용)
CREATE OR REPLACE VIEW memory_embedding_stats AS
SELECT
  persona_id,
  COUNT(*) AS total_memories,
  COUNT(embedding) AS embedded_memories,
  ROUND(COUNT(embedding)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS embedding_coverage_pct,
  AVG(importance_score) AS avg_importance,
  MIN(created_at) AS oldest_memory,
  MAX(created_at) AS newest_memory
FROM persona_memories
WHERE is_active = true
GROUP BY persona_id;

COMMENT ON VIEW memory_embedding_stats IS '페르소나별 메모리 임베딩 현황';
