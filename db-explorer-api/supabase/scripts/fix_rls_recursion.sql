-- Fix RLS infinite recursion issue
-- This script recreates the helper functions with SECURITY DEFINER
-- Run this directly on your Supabase database

-- Drop existing functions if they exist (they might have wrong implementation)
DROP FUNCTION IF EXISTS public.user_is_connection_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.user_has_connection_role(UUID, UUID, TEXT[]);

-- Recreate helper function to check if user is a member of a connection (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_is_connection_member(
  p_connection_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.connection_members
    WHERE connection_id = p_connection_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate helper function to check if user has specific role in connection (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_has_connection_role(
  p_connection_id UUID,
  p_user_id UUID,
  p_roles TEXT[]
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.connection_members
    WHERE connection_id = p_connection_id
    AND user_id = p_user_id
    AND role = ANY(p_roles::connection_role[])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop and recreate policies to use the helper functions
DROP POLICY IF EXISTS "Users can view members of their connections" ON public.connection_members;
DROP POLICY IF EXISTS "Owners and admins can add members" ON public.connection_members;
DROP POLICY IF EXISTS "Owners and admins can update member roles" ON public.connection_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON public.connection_members;
DROP POLICY IF EXISTS "Users can view connections they are members of" ON public.database_connections;
DROP POLICY IF EXISTS "Owners and admins can update connections" ON public.database_connections;
DROP POLICY IF EXISTS "Only owners can delete connections" ON public.database_connections;
DROP POLICY IF EXISTS "Users can view relevant invitations" ON public.connection_invitations;
DROP POLICY IF EXISTS "Owners and admins can create invitations" ON public.connection_invitations;

-- Recreate RLS Policies for connection_members
CREATE POLICY "Users can view members of their connections"
  ON public.connection_members
  FOR SELECT
  USING (
    public.user_is_connection_member(connection_id, auth.uid())
  );

CREATE POLICY "Owners and admins can add members"
  ON public.connection_members
  FOR INSERT
  WITH CHECK (
    public.user_has_connection_role(connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

CREATE POLICY "Owners and admins can update member roles"
  ON public.connection_members
  FOR UPDATE
  USING (
    public.user_has_connection_role(connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

CREATE POLICY "Owners and admins can remove members"
  ON public.connection_members
  FOR DELETE
  USING (
    public.user_has_connection_role(connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Recreate RLS Policies for database_connections
CREATE POLICY "Users can view connections they are members of"
  ON public.database_connections
  FOR SELECT
  USING (
    public.user_is_connection_member(id, auth.uid())
  );

CREATE POLICY "Owners and admins can update connections"
  ON public.database_connections
  FOR UPDATE
  USING (
    public.user_has_connection_role(id, auth.uid(), ARRAY['owner', 'admin'])
  );

CREATE POLICY "Only owners can delete connections"
  ON public.database_connections
  FOR DELETE
  USING (
    public.user_has_connection_role(id, auth.uid(), ARRAY['owner'])
  );

-- Recreate RLS Policies for connection_invitations
CREATE POLICY "Users can view relevant invitations"
  ON public.connection_invitations
  FOR SELECT
  USING (
    auth.uid() = invited_by OR
    auth.uid() = invited_user_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = connection_invitations.invited_email
    ) OR
    public.user_has_connection_role(connection_invitations.connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

CREATE POLICY "Owners and admins can create invitations"
  ON public.connection_invitations
  FOR INSERT
  WITH CHECK (
    public.user_has_connection_role(connection_invitations.connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Fix service role policies to include WITH CHECK for INSERT operations
DROP POLICY IF EXISTS "Service role has full access to connections" ON public.database_connections;
DROP POLICY IF EXISTS "Service role has full access to members" ON public.connection_members;
DROP POLICY IF EXISTS "Service role has full access to invitations" ON public.connection_invitations;

CREATE POLICY "Service role has full access to connections"
  ON public.database_connections
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access to members"
  ON public.connection_members
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role has full access to invitations"
  ON public.connection_invitations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

