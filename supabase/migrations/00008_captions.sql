ALTER TABLE analyses ADD COLUMN IF NOT EXISTS share_captions JSONB;

CREATE POLICY "Users can update own analyses"
  ON analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
