-- Move billing from Stripe to RevenueCat (Apple/Google In-App Purchases).
-- The revenuecat-webhook edge function upserts entitlement state here keyed by
-- user_id (= RevenueCat app_user_id = Supabase auth user id).
--
-- The original table required stripe_customer_id (NOT NULL); RevenueCat has no
-- Stripe customer, so relax it and add store-oriented columns. Existing Stripe
-- columns are kept (nullable) so historical rows are untouched.

ALTER TABLE user_subscriptions
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS store          TEXT,   -- 'app_store' | 'play_store'
  ADD COLUMN IF NOT EXISTS product_id     TEXT,   -- store product identifier
  ADD COLUMN IF NOT EXISTS rc_entitlement TEXT;   -- granting entitlement id

-- No client RLS policies are added: like the Stripe webhook, only the
-- revenuecat-webhook (service role) writes here. Clients read via existing
-- SELECT policy; RevenueCat customerInfo is the on-device source of truth.

NOTIFY pgrst, 'reload schema';
