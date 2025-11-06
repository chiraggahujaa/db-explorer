-- Rollback: Drop storage buckets and policies
-- Description: Removes avatars bucket and all related policies
-- Date: 2025-01-07

-- Note: Storage policies should be manually removed via Supabase Dashboard if created there
-- Storage > avatars bucket > Policies > Delete each policy

-- Delete bucket (this will cascade delete all files in the bucket)
DELETE FROM storage.buckets WHERE id = 'avatars';
