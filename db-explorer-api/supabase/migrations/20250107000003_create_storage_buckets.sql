-- Migration: Create storage buckets for file uploads
-- Description: Set up avatars bucket with policies
-- Author: Chirag
-- Date: 2025-01-07

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Note: Storage policies should be created via Supabase Dashboard
-- Go to: Storage > avatars bucket > Policies
-- Or use the Supabase SQL Editor with proper permissions
--
-- Policies needed:
-- 1. Public read: Allow SELECT for public on bucket_id = 'avatars'
-- 2. Authenticated upload: Allow INSERT for authenticated where bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
-- 3. Authenticated update: Allow UPDATE for authenticated where bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
-- 4. Authenticated delete: Allow DELETE for authenticated where bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
