-- Community feed hardening migration:
-- 1. UNIQUE constraint on analysis_id (1:1 post per analysis)
-- 2. Emoji whitelist enforced server-side
-- 3. Replace manual increment/decrement RPCs with trigger-based counters

ALTER TABLE community_posts ADD CONSTRAINT unique_post_per_analysis UNIQUE (analysis_id);

ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_emoji_check CHECK (emoji IN ('🔥','😭','💀','💯','😂'));

ALTER TABLE community_posts ALTER COLUMN reactions SET DEFAULT '{"🔥":0,"😭":0,"💀":0,"💯":0,"😂":0}';

DROP FUNCTION IF EXISTS increment_reaction(UUID, TEXT);
DROP FUNCTION IF EXISTS decrement_reaction(UUID, TEXT);

CREATE OR REPLACE FUNCTION sync_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts
    SET reactions = jsonb_set(
      reactions,
      ARRAY[NEW.emoji],
      to_jsonb(COALESCE((SELECT COUNT(*) FROM post_reactions WHERE post_id = NEW.post_id AND emoji = NEW.emoji), 0))
    )
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts
    SET reactions = jsonb_set(
      reactions,
      ARRAY[OLD.emoji],
      to_jsonb(COALESCE((SELECT COUNT(*) FROM post_reactions WHERE post_id = OLD.post_id AND emoji = OLD.emoji), 0))
    )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_reactions_insert ON post_reactions;
CREATE TRIGGER trg_post_reactions_insert
  AFTER INSERT ON post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_reaction_counts();

DROP TRIGGER IF EXISTS trg_post_reactions_delete ON post_reactions;
CREATE TRIGGER trg_post_reactions_delete
  AFTER DELETE ON post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_reaction_counts();

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON post_reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert reactions"
  ON post_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND username IS NOT NULL
    )
  );

CREATE POLICY "Users can delete own reactions"
  ON post_reactions FOR DELETE
  USING (auth.uid() = user_id);
