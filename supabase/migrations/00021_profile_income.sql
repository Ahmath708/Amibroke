-- Optional exact monthly income from onboarding's income step (docs/unified-financial-model.md).
-- The bracket (ctx_income_bracket) is still set; this stores the precise figure when the user
-- gives one, so the roast can prefer exact over the bracket. Additive + idempotent.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_income NUMERIC;
