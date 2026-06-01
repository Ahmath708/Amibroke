-- Anonymous username-availability check for the signup form. The hard auth gate
-- unmounts the signup screen the moment a session is created, so availability
-- must be checked BEFORE signUp (set_username remains the post-auth backstop).
-- SECURITY DEFINER so it can read profiles without exposing rows via RLS.

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE lower(username) = lower(trim(p_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
