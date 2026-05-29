-- Auth hardening migration:
-- 1. Make profiles.username nullable (UNIQUE still allows multiple NULLs)
-- 2. Fix handle_new_user to not crash on email-prefix collision (inserts NULL username)
-- 3. Gate community posting on having set a username
-- 4. Create set_username RPC for the frontend username-pickoff screen

ALTER TABLE profiles ALTER COLUMN username DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    NULL,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'New user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can insert own community posts" ON community_posts;
DROP POLICY IF EXISTS "Users post to community" ON community_posts;
CREATE POLICY "Users can insert own community posts (username required)"
  ON community_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND username IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.set_username(p_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  p_username := lower(trim(p_username));
  IF length(p_username) < 3 OR length(p_username) > 24 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_length');
  END IF;
  IF p_username !~ '^[a-z0-9_]+$' THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_charset');
  END IF;

  BEGIN
    UPDATE profiles SET username = p_username WHERE id = v_caller_id;
    RETURN json_build_object('ok', true, 'username', p_username);
  EXCEPTION
    WHEN unique_violation THEN
      RETURN json_build_object('ok', false, 'error', 'taken');
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_username(text) TO authenticated;
