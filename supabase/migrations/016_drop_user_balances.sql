-- 016_drop_user_balances.sql
-- LUMIN PASS 단일 구독 모델로 multi-currency 인프라 제거
-- 화폐는 users.tokens 단일로 통일
DROP TABLE IF EXISTS public.user_balances CASCADE;
