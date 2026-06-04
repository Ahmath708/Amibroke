-- Phase 1 of the unified financial model (docs/unified-financial-model.md): capture the
-- user's name during the now-mandatory onboarding. Powers the greeting + personalization.
-- Additive + idempotent; the existing "users update own profile" RLS already covers these.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;
