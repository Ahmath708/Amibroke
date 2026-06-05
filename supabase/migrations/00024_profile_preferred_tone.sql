-- Persist the user's chosen roast voice as a profile preference: the single source of truth for
-- tone (read by analyze, the check-in reflection, and any future tone-aware feature). Sticky —
-- the HomeScreen tone selector writes it and Settings can change it. Defaults to 'savage'.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_tone TEXT NOT NULL DEFAULT 'savage';
