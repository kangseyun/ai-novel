-- ============================================================================
-- 013_lumin_group.sql
-- LUMIN group metadata (group_id, member_role, MBTI, birthday, signature
-- color) and the group-chat infrastructure (rooms + messages).
--
-- New for the LUMIN pivot. Adds columns to persona_core for group metadata
-- and creates two new tables for the 7-member group chat experience.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extend persona_core with K-pop group metadata
-- ----------------------------------------------------------------------------
ALTER TABLE public.persona_core
  ADD COLUMN IF NOT EXISTS group_id          TEXT,
  ADD COLUMN IF NOT EXISTS member_role       TEXT,    -- 'leader','main_vocalist',…
  ADD COLUMN IF NOT EXISTS member_position   TEXT,    -- '메인보컬', '비주얼' … (display)
  ADD COLUMN IF NOT EXISTS mbti              TEXT,
  ADD COLUMN IF NOT EXISTS birthday          TEXT,    -- 'MM-DD'; year-agnostic
  ADD COLUMN IF NOT EXISTS signature_color   TEXT,    -- hex
  ADD COLUMN IF NOT EXISTS trainee_years     INTEGER,
  ADD COLUMN IF NOT EXISTS opening_message   TEXT;

CREATE INDEX IF NOT EXISTS idx_persona_core_group_id ON public.persona_core(group_id);

-- ----------------------------------------------------------------------------
-- group_chat_rooms — typically one row per (user, group), but the schema
-- supports multiple rooms (e.g. event-specific rooms during comeback).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_chat_rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id            TEXT NOT NULL,                 -- e.g. 'lumin'
  name                TEXT NOT NULL DEFAULT 'LUMIN 단톡방',
  description         TEXT,
  member_persona_ids  TEXT[] NOT NULL DEFAULT '{}',  -- which personas are in this room
  is_pinned           BOOLEAN NOT NULL DEFAULT false,
  unread_count        INTEGER NOT NULL DEFAULT 0,
  last_message_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_group_rooms_user
  ON public.group_chat_rooms(user_id, last_message_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS trg_group_chat_rooms_updated_at ON public.group_chat_rooms;
CREATE TRIGGER trg_group_chat_rooms_updated_at
  BEFORE UPDATE ON public.group_chat_rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- group_chat_messages — message stream within a room
-- A message can be from the user (sender_user=true, sender_persona_id NULL)
-- or from a specific persona (sender_user=false, sender_persona_id NOT NULL).
-- A 'system' message has both NULL/false (e.g. event banners).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES public.group_chat_rooms(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  sender_persona_id   TEXT REFERENCES public.persona_core(id) ON DELETE SET NULL,
  sender_user         BOOLEAN NOT NULL DEFAULT false,
  message_type        TEXT NOT NULL DEFAULT 'text'
                      CHECK (message_type IN ('text','image','audio','sticker','event','system')),

  content             TEXT,
  media_url           TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

  reply_to_id         UUID REFERENCES public.group_chat_messages(id) ON DELETE SET NULL,
  reactions           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Sequence to keep chronological order stable even within the same instant
  sequence_number     BIGSERIAL,

  is_read             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_room
  ON public.group_chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_user
  ON public.group_chat_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_messages_unread
  ON public.group_chat_messages(room_id, is_read) WHERE is_read = false;

-- Auto-update last_message_at + unread_count on the parent room
CREATE OR REPLACE FUNCTION public.bump_group_room_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.group_chat_rooms
     SET last_message_at = NEW.created_at,
         unread_count    = CASE
                              WHEN NEW.sender_user THEN unread_count
                              ELSE unread_count + 1
                            END,
         updated_at      = NOW()
   WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bump_group_room_on_message ON public.group_chat_messages;
CREATE TRIGGER trg_bump_group_room_on_message
  AFTER INSERT ON public.group_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_group_room_on_message();

-- Convenience: mark all messages in a room read for a user
CREATE OR REPLACE FUNCTION public.mark_group_messages_read(
  p_user_id UUID, p_room_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.group_chat_messages
       SET is_read = true
     WHERE room_id = p_room_id
       AND user_id = p_user_id
       AND sender_user = false
       AND is_read = false
     RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM updated;

  UPDATE public.group_chat_rooms
     SET unread_count = 0, updated_at = NOW()
   WHERE id = p_room_id AND user_id = p_user_id;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.group_chat_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_chat_rooms_self" ON public.group_chat_rooms;
CREATE POLICY "group_chat_rooms_self" ON public.group_chat_rooms
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "group_chat_messages_self" ON public.group_chat_messages;
CREATE POLICY "group_chat_messages_self" ON public.group_chat_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
