-- Restrict storage uploads to user's own directory
-- Replaces the overly permissive INSERT policy

DROP POLICY IF EXISTS "Users can upload captures" ON storage.objects;

CREATE POLICY "Users can upload to own folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'captures'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'captures'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can update/delete only their own uploads
CREATE POLICY "Users can manage own uploads" ON storage.objects
  FOR ALL USING (
    bucket_id = 'captures'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'captures'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
