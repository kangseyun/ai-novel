-- ============================================
-- user_persona_relationships 외래키 수정
-- personas_legacy 대신 persona_core 참조
-- ============================================

-- 1. 기존 외래키 제약조건 삭제 (존재하는 경우)
-- user_persona_relationships에서 personas_legacy를 참조하는 FK 삭제
DO $$
BEGIN
  -- 외래키 이름이 다를 수 있으므로 여러 패턴 시도
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_persona_relationships_persona_id_fkey'
    AND table_name = 'user_persona_relationships'
  ) THEN
    ALTER TABLE user_persona_relationships
    DROP CONSTRAINT user_persona_relationships_persona_id_fkey;
  END IF;

  -- fk_ 패턴으로 시작하는 외래키도 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE 'fk_%persona%'
    AND table_name = 'user_persona_relationships'
  ) THEN
    -- 동적으로 삭제
    EXECUTE (
      SELECT 'ALTER TABLE user_persona_relationships DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_name LIKE 'fk_%persona%'
      AND table_name = 'user_persona_relationships'
      LIMIT 1
    );
  END IF;
END $$;

-- 2. 새로운 외래키 추가 (persona_core 참조)
-- 이미 존재하면 무시
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_persona_relationships_persona_core_fkey'
    AND table_name = 'user_persona_relationships'
  ) THEN
    ALTER TABLE user_persona_relationships
    ADD CONSTRAINT user_persona_relationships_persona_core_fkey
    FOREIGN KEY (persona_id) REFERENCES persona_core(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN
    -- 외래키 추가 실패 시 (예: persona_core에 데이터가 없는 경우)
    -- 외래키 없이 진행
    RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
END $$;

-- 3. relationship_milestones 테이블도 동일하게 처리
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'relationship_milestones_persona_id_fkey'
    AND table_name = 'relationship_milestones'
  ) THEN
    ALTER TABLE relationship_milestones
    DROP CONSTRAINT relationship_milestones_persona_id_fkey;
  END IF;
END $$;

-- 4. user_journey_stats 테이블도 동일하게 처리
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_journey_stats_persona_id_fkey'
    AND table_name = 'user_journey_stats'
  ) THEN
    ALTER TABLE user_journey_stats
    DROP CONSTRAINT user_journey_stats_persona_id_fkey;
  END IF;
END $$;

-- 5. purchases 테이블의 persona 관련 외래키도 확인
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%persona%'
    AND table_name = 'purchases'
  ) THEN
    -- purchases 테이블은 metadata JSONB로 persona_id를 저장하므로 FK 없음
    NULL;
  END IF;
END $$;
