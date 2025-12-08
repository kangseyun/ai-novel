-- scenario_templates.persona_id -> persona_core.id 외래 키 추가
-- 이를 통해 Supabase에서 조인 쿼리가 가능해짐

ALTER TABLE scenario_templates
ADD CONSTRAINT scenario_templates_persona_id_fkey
FOREIGN KEY (persona_id) REFERENCES persona_core(id)
ON DELETE CASCADE;
