-- Community posts (shared analysis results visible in the feed)
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  score_label TEXT NOT NULL,
  roast TEXT NOT NULL,
  summary TEXT NOT NULL,
  reactions JSONB NOT NULL DEFAULT '{"fire":0,"cry":0,"skull":0}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view community posts"
  ON community_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own community posts"
  ON community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own community posts"
  ON community_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Track individual user reactions per post (prevents double-voting)
CREATE TABLE post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id, emoji)
);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON post_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can manage own reactions"
  ON post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON post_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- User subscriptions (manual entry for audit)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  icon TEXT,
  category TEXT,
  last_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Monthly check-ins (mood, notes, financial snapshot)
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mood INTEGER NOT NULL,
  notes TEXT,
  income NUMERIC,
  expenses NUMERIC,
  savings NUMERIC,
  debt NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own check-ins"
  ON check_ins FOR ALL
  USING (auth.uid() = user_id);

-- Creator referrals (behind feature flag until paywall is real)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payout_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrers can view own referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Referrers can insert referrals"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- Indexes
CREATE INDEX idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_check_ins_user ON check_ins(user_id);
CREATE INDEX idx_check_ins_created ON check_ins(created_at DESC);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- RPC functions for reaction counters
CREATE OR REPLACE FUNCTION increment_reaction(post_id UUID, reaction_key TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_val INT;
BEGIN
  SELECT COALESCE((reactions->>reaction_key)::int, 0) INTO current_val
  FROM community_posts WHERE id = post_id;
  UPDATE community_posts
  SET reactions = jsonb_set(reactions, ARRAY[reaction_key], to_jsonb(current_val + 1))
  WHERE id = post_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_reaction(post_id UUID, reaction_key TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_val INT;
BEGIN
  SELECT COALESCE((reactions->>reaction_key)::int, 1) INTO current_val
  FROM community_posts WHERE id = post_id;
  UPDATE community_posts
  SET reactions = jsonb_set(reactions, ARRAY[reaction_key], to_jsonb(GREATEST(current_val - 1, 0)))
  WHERE id = post_id;
END;
$$;
