-- Allow authenticated users to insert their own profile row.
-- This is needed for updateProfile upsert to work if the auth trigger
-- didn't fire (e.g., during development or if the trigger is ever disabled).
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
