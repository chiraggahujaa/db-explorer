-- Migration: Create user sessions table
-- Description: Track user login sessions and refresh tokens
-- Author: Chirag
-- Date: 2025-01-07

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_refresh_token ON public.user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout)
CREATE POLICY "Users can delete own sessions"
  ON public.user_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access"
  ON public.user_sessions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public.user_sessions IS 'User authentication sessions and refresh tokens';
COMMENT ON COLUMN public.user_sessions.refresh_token IS 'Refresh token for session renewal';
COMMENT ON COLUMN public.user_sessions.expires_at IS 'Session expiration timestamp';
