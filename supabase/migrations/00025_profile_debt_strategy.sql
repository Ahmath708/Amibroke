-- Remember the user's chosen debt-payoff strategy (avalanche/snowball) so the Debt Payoff screen
-- doesn't reset to the default on every visit. Sticky, like preferred_tone. Defaults to 'avalanche'.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS debt_strategy TEXT NOT NULL DEFAULT 'avalanche';
