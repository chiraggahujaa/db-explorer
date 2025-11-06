-- Rollback: Drop user sessions table and related objects
-- Description: Removes user_sessions table, functions, and policies
-- Date: 2025-01-07

-- Drop functions
DROP FUNCTION IF EXISTS public.cleanup_expired_sessions();

-- Drop policies
DROP POLICY IF EXISTS "Service role has full access" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_user_sessions_expires_at;
DROP INDEX IF EXISTS public.idx_user_sessions_refresh_token;
DROP INDEX IF EXISTS public.idx_user_sessions_user_id;

-- Drop table
DROP TABLE IF EXISTS public.user_sessions CASCADE;
