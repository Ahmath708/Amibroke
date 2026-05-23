-- 1. Create a public storage bucket for avatars if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Configure RLS (Row Level Security) on storage.objects for this bucket
-- Allow public select (read) access to the avatars bucket
CREATE POLICY "Public Select Avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Allow authenticated users to upload files to their own subfolder inside 'avatars'
-- foldername(name)[1] parses the first directory segment (which will match their User ID)
CREATE POLICY "Users Can Insert Own Avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own files
CREATE POLICY "Users Can Update Own Avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users Can Delete Own Avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
