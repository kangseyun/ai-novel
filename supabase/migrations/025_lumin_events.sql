-- ============================================================================
-- 025_lumin_events.sql
-- Group-level LUMIN calendar (member birthdays, debut anniversary, comeback
-- D-day, fan-day events). Distinct from public.scheduled_events which is
-- per-user delivery; this table is the source-of-truth for the *group*
-- calendar. The runtime can fan out to individual scheduled_events near
-- the date, or admins can use it just as a planning tool for now.
--
-- Seeded with the debut anniversary documented in docs/LUMIN.md (4/7).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lumin_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL CHECK (type IN (
                    'member_birthday','debut_anniversary','comeback','release','fan_day','custom'
                  )),
  title           TEXT NOT NULL,
  description     TEXT,
  persona_id      TEXT REFERENCES public.persona_core(id) ON DELETE SET NULL,
  -- For yearly recurring (birthday/debut) we store month+day; for one-off we
  -- store the absolute date. UI decides which to show on a given calendar.
  recur_month     SMALLINT CHECK (recur_month BETWEEN 1 AND 12),
  recur_day       SMALLINT CHECK (recur_day BETWEEN 1 AND 31),
  event_date      DATE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lumin_events_date_or_recur CHECK (
    event_date IS NOT NULL OR (recur_month IS NOT NULL AND recur_day IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lumin_events_persona     ON public.lumin_events(persona_id);
CREATE INDEX IF NOT EXISTS idx_lumin_events_type        ON public.lumin_events(type);
CREATE INDEX IF NOT EXISTS idx_lumin_events_event_date  ON public.lumin_events(event_date);
CREATE INDEX IF NOT EXISTS idx_lumin_events_recur       ON public.lumin_events(recur_month, recur_day);

DROP TRIGGER IF EXISTS trg_lumin_events_updated_at ON public.lumin_events;
CREATE TRIGGER trg_lumin_events_updated_at
  BEFORE UPDATE ON public.lumin_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.lumin_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lumin_events_read" ON public.lumin_events;
CREATE POLICY "lumin_events_read" ON public.lumin_events
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

DROP POLICY IF EXISTS "lumin_events_admin_write" ON public.lumin_events;
CREATE POLICY "lumin_events_admin_write" ON public.lumin_events
  FOR ALL TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

-- Seed: debut anniversary (4/7 per docs/LUMIN.md). Member birthdays remain
-- empty so admins fill them in once the canonical dates are settled.
INSERT INTO public.lumin_events (type, title, description, recur_month, recur_day, metadata)
VALUES (
  'debut_anniversary',
  'LUMIN 데뷔 기념일',
  '7명 합창 메시지 + 단톡방 깜짝 파티 (자동 발사)',
  4, 7,
  '{"source":"docs/LUMIN.md","auto_fan_out":true}'::jsonb
)
ON CONFLICT DO NOTHING;
