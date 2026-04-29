-- ============================================================================
-- 005_memory.sql
-- Semantic memory system: persona_memories (long-term events),
-- persona_lore (background facts), conversation_memories (raw turns),
-- per-persona memory type registry, embeddings (pgvector, 1536 dim),
-- and hybrid / semantic search RPCs.
--
-- Embedding model assumption: OpenAI text-embedding-3-large with
-- dimensions=1536 (HNSW index needs <2000 dims).
--
-- Consolidates legacy migrations: 012 (persona_memories base),
-- 015 (importance/active/source extensions), 021 (semantic search v1),
-- 022 (1536-dim upgrade + lore + conversation_memories),
-- 024 (per-persona memory types + defaults).
-- ============================================================================

-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- persona_memories — long-term meaningful events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_memories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id          TEXT NOT NULL,

  -- Memory type. Open-ended (no CHECK) so per-persona custom types
  -- registered in persona_memory_types are valid.
  memory_type         TEXT NOT NULL,

  summary             TEXT NOT NULL,
  details             JSONB NOT NULL DEFAULT '{}'::jsonb,

  emotional_weight    INTEGER NOT NULL DEFAULT 5
                      CHECK (emotional_weight BETWEEN 1 AND 10),
  importance_score    INTEGER NOT NULL DEFAULT 5
                      CHECK (importance_score BETWEEN 1 AND 10),

  affection_at_time   INTEGER,
  reference_count     INTEGER NOT NULL DEFAULT 0,
  last_referenced_at  TIMESTAMPTZ,

  is_active           BOOLEAN NOT NULL DEFAULT true,
  expires_at          TIMESTAMPTZ,

  source_type         TEXT NOT NULL DEFAULT 'dm'
                      CHECK (source_type IN ('dm', 'scenario', 'event', 'system')),
  source_id           TEXT,

  -- Embedding & search text (auto-maintained by trigger)
  searchable_text     TEXT,
  embedding           vector(1536),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, persona_id, memory_type, summary)
);

CREATE INDEX IF NOT EXISTS idx_persona_memories_user_persona
  ON public.persona_memories(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_memories_user_persona_active
  ON public.persona_memories(user_id, persona_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_persona_memories_active_importance
  ON public.persona_memories(user_id, persona_id, importance_score DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_persona_memories_type_active
  ON public.persona_memories(user_id, persona_id, memory_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_persona_memories_searchable_text
  ON public.persona_memories USING gin (to_tsvector('simple', searchable_text));
CREATE INDEX IF NOT EXISTS idx_persona_memories_embedding
  ON public.persona_memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Auto-build searchable_text on write
CREATE OR REPLACE FUNCTION public.update_memory_searchable_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.searchable_text :=
    COALESCE(NEW.summary, '') || ' ' || COALESCE(NEW.details::text, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memory_searchable_text ON public.persona_memories;
CREATE TRIGGER trg_memory_searchable_text
  BEFORE INSERT OR UPDATE ON public.persona_memories
  FOR EACH ROW EXECUTE FUNCTION public.update_memory_searchable_text();

-- ----------------------------------------------------------------------------
-- persona_lore — persona background / world facts (vector-searchable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.persona_lore (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id        TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,
  category          TEXT NOT NULL,    -- 'background','personality','relationship','world','secret'
  key               TEXT NOT NULL,
  content           TEXT NOT NULL,
  embedding         vector(1536),
  importance_score  INTEGER NOT NULL DEFAULT 5,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, key)
);

CREATE INDEX IF NOT EXISTS idx_persona_lore_persona
  ON public.persona_lore(persona_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_persona_lore_embedding
  ON public.persona_lore USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

DROP TRIGGER IF EXISTS trg_persona_lore_updated_at ON public.persona_lore;
CREATE TRIGGER trg_persona_lore_updated_at
  BEFORE UPDATE ON public.persona_lore
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- conversation_memories — raw recent turns (vector-searchable)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_memories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id        TEXT NOT NULL,
  session_id        UUID REFERENCES public.conversation_sessions(id) ON DELETE SET NULL,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  embedding         vector(1536),
  importance_score  INTEGER NOT NULL DEFAULT 5,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_memories_user_persona
  ON public.conversation_memories(user_id, persona_id, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_conv_memories_embedding
  ON public.conversation_memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ----------------------------------------------------------------------------
-- Memory type registry (per persona) + defaults
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.default_memory_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id         TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  emoji           TEXT NOT NULL DEFAULT '📝',
  min_affection   INTEGER,
  min_stage       TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.default_memory_types
  (type_id, title, description, emoji, min_affection, min_stage, display_order) VALUES
  ('first_meeting',    '첫 만남',     '처음 대화를 나눈 순간',          '✨', NULL, NULL, 1),
  ('promise',          '약속',        '함께 한 약속들',                 '🤙', NULL, NULL, 2),
  ('secret_shared',    '비밀',        '서로 나눈 비밀 이야기',          '🤫', 30,   'friend', 3),
  ('reconciliation',   '화해',        '갈등 후 화해한 순간',            '🤗', 30,   NULL, 4),
  ('intimate_moment',  '특별한 순간', '마음이 가까워진 순간',           '💕', 60,   'close', 5),
  ('gift_received',    '선물',        '주고받은 선물들',                '🎁', NULL, 'fan', 6),
  ('milestone',        '기념일',      '함께한 특별한 날들',             '🎉', NULL, NULL, 7)
ON CONFLICT (type_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.persona_memory_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id      TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,
  type_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  emoji           TEXT NOT NULL DEFAULT '📝',
  min_affection   INTEGER,
  min_stage       TEXT,
  required_flag   TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, type_id)
);

CREATE INDEX IF NOT EXISTS idx_persona_memory_types_persona
  ON public.persona_memory_types(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_memory_types_order
  ON public.persona_memory_types(persona_id, display_order);

-- Auto-seed defaults whenever a new persona is created
CREATE OR REPLACE FUNCTION public.copy_default_memory_types()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.persona_memory_types
    (persona_id, type_id, title, description, emoji,
     min_affection, min_stage, display_order, is_default)
  SELECT NEW.id, dmt.type_id, dmt.title, dmt.description, dmt.emoji,
         dmt.min_affection, dmt.min_stage, dmt.display_order, true
    FROM public.default_memory_types dmt
  ON CONFLICT (persona_id, type_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_copy_default_memory_types ON public.persona_core;
CREATE TRIGGER trg_copy_default_memory_types
  AFTER INSERT ON public.persona_core
  FOR EACH ROW EXECUTE FUNCTION public.copy_default_memory_types();

CREATE OR REPLACE FUNCTION public.get_persona_memory_types(p_persona_id TEXT)
RETURNS TABLE (
  type_id        TEXT,
  title          TEXT,
  description    TEXT,
  emoji          TEXT,
  min_affection  INTEGER,
  min_stage      TEXT,
  required_flag  TEXT,
  display_order  INTEGER,
  is_default     BOOLEAN
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT pmt.type_id, pmt.title, pmt.description, pmt.emoji,
         pmt.min_affection, pmt.min_stage, pmt.required_flag,
         pmt.display_order, pmt.is_default
    FROM public.persona_memory_types pmt
   WHERE pmt.persona_id = p_persona_id
   ORDER BY pmt.display_order ASC;
END;
$$;

-- ----------------------------------------------------------------------------
-- Reference-count helper + cleanup utility
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_memory_reference(p_memory_id UUID)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.persona_memories
     SET reference_count    = COALESCE(reference_count, 0) + 1,
         last_referenced_at = NOW()
   WHERE id = p_memory_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_memory_embeddings(p_embeddings JSONB)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
  v_count INT := 0;
  v_item  JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_embeddings) LOOP
    UPDATE public.persona_memories
       SET embedding = (
             SELECT array_agg(x::FLOAT)::vector(1536)
               FROM jsonb_array_elements_text(v_item->'embedding') AS x
           )
     WHERE id = (v_item->>'id')::UUID;
    IF FOUND THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- Search RPCs (semantic / hybrid / lore / conversation / unified)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_memories_semantic(
  p_user_id          UUID,
  p_persona_id       TEXT,
  p_query_embedding  vector(1536),
  p_match_threshold  FLOAT DEFAULT 0.7,
  p_match_count      INT   DEFAULT 5
)
RETURNS TABLE (
  id               UUID,
  memory_type      TEXT,
  summary          TEXT,
  details          JSONB,
  emotional_weight INTEGER,
  importance_score INTEGER,
  similarity       FLOAT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT pm.id, pm.memory_type, pm.summary, pm.details,
         pm.emotional_weight, pm.importance_score,
         1 - (pm.embedding <=> p_query_embedding) AS similarity,
         pm.created_at
    FROM public.persona_memories pm
   WHERE pm.user_id   = p_user_id
     AND pm.persona_id = p_persona_id
     AND pm.is_active  = true
     AND pm.embedding IS NOT NULL
     AND 1 - (pm.embedding <=> p_query_embedding) > p_match_threshold
   ORDER BY pm.embedding <=> p_query_embedding
   LIMIT p_match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_memories_hybrid(
  p_user_id          UUID,
  p_persona_id       TEXT,
  p_query_embedding  vector(1536),
  p_keywords         TEXT[] DEFAULT NULL,
  p_match_threshold  FLOAT DEFAULT 0.5,
  p_match_count      INT   DEFAULT 10
)
RETURNS TABLE (
  id               UUID,
  memory_type      TEXT,
  summary          TEXT,
  details          JSONB,
  emotional_weight INTEGER,
  importance_score INTEGER,
  semantic_score   FLOAT,
  keyword_score    FLOAT,
  final_score      FLOAT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE AS $$
DECLARE v_has_kw BOOLEAN;
BEGIN
  v_has_kw := p_keywords IS NOT NULL AND array_length(p_keywords, 1) > 0;
  RETURN QUERY
  SELECT
    pm.id, pm.memory_type, pm.summary, pm.details,
    pm.emotional_weight, pm.importance_score,
    CASE WHEN pm.embedding IS NOT NULL
         THEN 1 - (pm.embedding <=> p_query_embedding) ELSE 0 END AS semantic_score,
    CASE WHEN v_has_kw THEN (
      SELECT COUNT(*)::FLOAT / array_length(p_keywords, 1)
        FROM unnest(p_keywords) AS kw
       WHERE pm.searchable_text ILIKE '%' || kw || '%'
    ) ELSE 0 END AS keyword_score,
    (
      CASE WHEN pm.embedding IS NOT NULL
           THEN (1 - (pm.embedding <=> p_query_embedding)) * 0.5 ELSE 0 END
      + CASE WHEN v_has_kw THEN (
          SELECT COUNT(*)::FLOAT / array_length(p_keywords, 1)
            FROM unnest(p_keywords) AS kw
           WHERE pm.searchable_text ILIKE '%' || kw || '%'
        ) * 0.3 ELSE 0 END
      + (pm.importance_score::FLOAT / 10) * 0.2
    ) AS final_score,
    pm.created_at
  FROM public.persona_memories pm
  WHERE pm.user_id   = p_user_id
    AND pm.persona_id = p_persona_id
    AND pm.is_active  = true
    AND (
      (pm.embedding IS NOT NULL AND 1 - (pm.embedding <=> p_query_embedding) > p_match_threshold)
      OR (v_has_kw AND EXISTS (
        SELECT 1 FROM unnest(p_keywords) AS kw
         WHERE pm.searchable_text ILIKE '%' || kw || '%'
      ))
    )
  ORDER BY final_score DESC
  LIMIT p_match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_lore_semantic(
  p_persona_id       TEXT,
  p_query_embedding  vector(1536),
  p_match_threshold  FLOAT DEFAULT 0.6,
  p_match_count      INT   DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  category    TEXT,
  key         TEXT,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT pl.id, pl.category, pl.key, pl.content,
         1 - (pl.embedding <=> p_query_embedding) AS similarity
    FROM public.persona_lore pl
   WHERE pl.persona_id = p_persona_id
     AND pl.is_active  = true
     AND pl.embedding IS NOT NULL
     AND 1 - (pl.embedding <=> p_query_embedding) > p_match_threshold
   ORDER BY pl.embedding <=> p_query_embedding
   LIMIT p_match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_conversation_memories(
  p_user_id          UUID,
  p_persona_id       TEXT,
  p_query_embedding  vector(1536),
  p_match_threshold  FLOAT DEFAULT 0.65,
  p_match_count      INT   DEFAULT 10
)
RETURNS TABLE (
  id          UUID,
  role        TEXT,
  content     TEXT,
  similarity  FLOAT,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT cm.id, cm.role, cm.content,
         1 - (cm.embedding <=> p_query_embedding) AS similarity,
         cm.created_at
    FROM public.conversation_memories cm
   WHERE cm.user_id   = p_user_id
     AND cm.persona_id = p_persona_id
     AND cm.is_active  = true
     AND cm.embedding IS NOT NULL
     AND 1 - (cm.embedding <=> p_query_embedding) > p_match_threshold
   ORDER BY cm.embedding <=> p_query_embedding
   LIMIT p_match_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_all_context(
  p_user_id              UUID,
  p_persona_id           TEXT,
  p_query_embedding      vector(1536),
  p_match_threshold      FLOAT DEFAULT 0.6,
  p_memory_count         INT   DEFAULT 5,
  p_conversation_count   INT   DEFAULT 5,
  p_lore_count           INT   DEFAULT 3
)
RETURNS TABLE (
  source_type TEXT,
  content     TEXT,
  similarity  FLOAT,
  metadata    JSONB
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT 'memory'::TEXT, pm.summary,
         1 - (pm.embedding <=> p_query_embedding),
         jsonb_build_object('memory_type', pm.memory_type,
                            'emotional_weight', pm.emotional_weight,
                            'created_at', pm.created_at)
    FROM public.persona_memories pm
   WHERE pm.user_id   = p_user_id
     AND pm.persona_id = p_persona_id
     AND pm.is_active  = true
     AND pm.embedding IS NOT NULL
     AND 1 - (pm.embedding <=> p_query_embedding) > p_match_threshold
   ORDER BY pm.embedding <=> p_query_embedding
   LIMIT p_memory_count;

  RETURN QUERY
  SELECT 'conversation'::TEXT, cm.content,
         1 - (cm.embedding <=> p_query_embedding),
         jsonb_build_object('role', cm.role, 'created_at', cm.created_at)
    FROM public.conversation_memories cm
   WHERE cm.user_id   = p_user_id
     AND cm.persona_id = p_persona_id
     AND cm.is_active  = true
     AND cm.embedding IS NOT NULL
     AND 1 - (cm.embedding <=> p_query_embedding) > p_match_threshold
   ORDER BY cm.embedding <=> p_query_embedding
   LIMIT p_conversation_count;

  RETURN QUERY
  SELECT 'lore'::TEXT, pl.content,
         1 - (pl.embedding <=> p_query_embedding),
         jsonb_build_object('category', pl.category, 'key', pl.key)
    FROM public.persona_lore pl
   WHERE pl.persona_id = p_persona_id
     AND pl.is_active  = true
     AND pl.embedding IS NOT NULL
     AND 1 - (pl.embedding <=> p_query_embedding) > p_match_threshold
   ORDER BY pl.embedding <=> p_query_embedding
   LIMIT p_lore_count;
END;
$$;

-- Coverage diagnostic view
CREATE OR REPLACE VIEW public.memory_embedding_stats AS
SELECT
  persona_id,
  COUNT(*)         AS total_memories,
  COUNT(embedding) AS embedded_memories,
  ROUND((COUNT(embedding)::numeric / NULLIF(COUNT(*), 0) * 100), 2) AS embedding_coverage_pct,
  AVG(importance_score) AS avg_importance,
  MIN(created_at)  AS oldest_memory,
  MAX(created_at)  AS newest_memory
FROM public.persona_memories
WHERE is_active = true
GROUP BY persona_id;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.persona_memories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_lore           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_memories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_memory_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_memory_types   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "persona_memories_self" ON public.persona_memories;
CREATE POLICY "persona_memories_self" ON public.persona_memories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversation_memories_self" ON public.conversation_memories;
CREATE POLICY "conversation_memories_self" ON public.conversation_memories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "persona_lore_read" ON public.persona_lore;
CREATE POLICY "persona_lore_read" ON public.persona_lore FOR SELECT USING (true);

DROP POLICY IF EXISTS "persona_lore_admin_write" ON public.persona_lore;
CREATE POLICY "persona_lore_admin_write" ON public.persona_lore
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "persona_memory_types_read" ON public.persona_memory_types;
CREATE POLICY "persona_memory_types_read" ON public.persona_memory_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "persona_memory_types_admin_write" ON public.persona_memory_types;
CREATE POLICY "persona_memory_types_admin_write" ON public.persona_memory_types
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'));

DROP POLICY IF EXISTS "default_memory_types_read" ON public.default_memory_types;
CREATE POLICY "default_memory_types_read" ON public.default_memory_types FOR SELECT USING (true);
