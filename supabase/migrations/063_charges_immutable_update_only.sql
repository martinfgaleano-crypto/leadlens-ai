-- 063_charges_immutable_update_only.sql
-- Fix a self-inconsistency introduced by 062: account_intelligence_charges has
-- `user_id ... ON DELETE CASCADE` but an immutability trigger that forbids BOTH UPDATE AND
-- DELETE. The DELETE forbid blocks the FK cascade, so a customer profile with any charge row can
-- no longer be deleted (account closure / GDPR erasure fails), and disposable test data cannot be
-- cleaned up. The append-only intent only requires that a RECORDED charge is never MUTATED — it
-- does not require blocking deletion. This recreates the guard as UPDATE-only.
--
-- Additive + backward compatible: no columns/constraints change; only the trigger scope narrows.
-- ROLLBACK (restore 062 behavior):
--   DROP TRIGGER IF EXISTS account_intelligence_charges_immutable ON public.account_intelligence_charges;
--   CREATE TRIGGER account_intelligence_charges_immutable
--     BEFORE UPDATE OR DELETE ON public.account_intelligence_charges
--     FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
-- APPLY: Supabase SQL editor (or `supabase db push`). NOT APPLIED by this repo — founder applies.

-- Message kept generic (function is shared); scope is set by the trigger below.
CREATE OR REPLACE FUNCTION public.forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'account_intelligence_charges rows are immutable (no in-place update)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_intelligence_charges_immutable ON public.account_intelligence_charges;
CREATE TRIGGER account_intelligence_charges_immutable
  BEFORE UPDATE ON public.account_intelligence_charges
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
