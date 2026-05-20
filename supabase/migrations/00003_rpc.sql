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
