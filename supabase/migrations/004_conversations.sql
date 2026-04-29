-- ============================================================================
-- 004_conversations.sql
-- Direct-message conversation system: sessions, messages, summaries,
-- unread tracking. Drives the AIEngine's chat loop.
--
-- Consolidates legacy migrations: implicit conversation_sessions/messages
-- (referenced in 012/019/023), 023 (unread tracking), 012 (summaries).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- conversation_sessions — one per (user, persona) chat thread
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id            TEXT NOT NULL REFERENCES public.persona_core(id) ON DELETE CASCADE,

  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'ended')),

  -- Snapshot at session start
  affection_at_start    INTEGER NOT NULL DEFAULT 0,
  relationship_stage    TEXT    NOT NULL DEFAULT 'stranger',

  -- Live engine state
  emotional_state       JSONB NOT NULL DEFAULT '{"persona_mood":"neutral","tension_level":0}'::jsonb,
  active_flags          JSONB NOT NULL DEFAULT '{}'::jsonb,

  last_message_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_sessions_user_persona
  ON public.conversation_sessions(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_conv_sessions_user_updated
  ON public.conversation_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_sessions_user_last_msg
  ON public.conversation_sessions(user_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conv_sessions_status
  ON public.conversation_sessions(status);

DROP TRIGGER IF EXISTS trg_conv_sessions_updated_at ON public.conversation_sessions;
CREATE TRIGGER trg_conv_sessions_updated_at
  BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- conversation_messages — every user/persona/system turn
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,

  role                TEXT NOT NULL CHECK (role IN ('user', 'persona', 'system')),
  content             TEXT NOT NULL,
  emotion             TEXT,
  inner_thought       TEXT,
  choice_data         JSONB,
  affection_change    INTEGER NOT NULL DEFAULT 0,
  flags_changed       JSONB NOT NULL DEFAULT '{}'::jsonb,
  sequence_number     INTEGER NOT NULL DEFAULT 0,

  -- Read tracking: persona messages start unread, user messages auto-read
  is_read             BOOLEAN NOT NULL DEFAULT true,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_session_seq
  ON public.conversation_messages(session_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_session_time
  ON public.conversation_messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_unread
  ON public.conversation_messages(is_read)
  WHERE is_read = false AND role = 'persona';

-- Auto read-state on insert: user msg = read, persona msg = unread
CREATE OR REPLACE FUNCTION public.set_message_read_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'user' THEN
    NEW.is_read := true;
  ELSIF NEW.role = 'persona' THEN
    NEW.is_read := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_read_status ON public.conversation_messages;
CREATE TRIGGER trg_message_read_status
  BEFORE INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_message_read_status();

-- ----------------------------------------------------------------------------
-- conversation_summaries — compressed memory of past sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  persona_id        TEXT NOT NULL,
  session_id        UUID REFERENCES public.conversation_sessions(id) ON DELETE SET NULL,

  summary_type      TEXT NOT NULL CHECK (summary_type IN (
                      'session', 'daily', 'weekly', 'relationship_arc'
                    )),
  summary           TEXT NOT NULL,
  topics            TEXT[] NOT NULL DEFAULT '{}',
  emotional_arc     JSONB  NOT NULL DEFAULT '{}'::jsonb,

  affection_start   INTEGER,
  affection_end     INTEGER,
  flags_set         JSONB NOT NULL DEFAULT '{}'::jsonb,

  period_start      TIMESTAMPTZ,
  period_end        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_summaries_user_persona
  ON public.conversation_summaries(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_session
  ON public.conversation_summaries(session_id);

-- ----------------------------------------------------------------------------
-- Unread tracking RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_counts(p_user_id UUID)
RETURNS TABLE (persona_id TEXT, unread_count BIGINT)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT cs.persona_id, COUNT(cm.id)::BIGINT
    FROM public.conversation_sessions cs
    JOIN public.conversation_messages cm ON cm.session_id = cs.id
   WHERE cs.user_id = p_user_id
     AND cm.role = 'persona'
     AND cm.is_read = false
   GROUP BY cs.persona_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_total_unread_count(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql STABLE AS $$
DECLARE v_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM public.conversation_messages cm
    JOIN public.conversation_sessions cs ON cm.session_id = cs.id
   WHERE cs.user_id = p_user_id
     AND cm.role = 'persona'
     AND cm.is_read = false;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  p_user_id UUID, p_persona_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.conversation_messages cm
       SET is_read = true
      FROM public.conversation_sessions cs
     WHERE cm.session_id = cs.id
       AND cs.user_id = p_user_id
       AND cs.persona_id = p_persona_id
       AND cm.role = 'persona'
       AND cm.is_read = false
     RETURNING cm.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.conversation_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_sessions_self" ON public.conversation_sessions;
CREATE POLICY "conv_sessions_self" ON public.conversation_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_messages_self" ON public.conversation_messages;
CREATE POLICY "conv_messages_self" ON public.conversation_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_sessions cs
     WHERE cs.id = session_id AND cs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversation_sessions cs
     WHERE cs.id = session_id AND cs.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "conv_summaries_self" ON public.conversation_summaries;
CREATE POLICY "conv_summaries_self" ON public.conversation_summaries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
