-- Migration: Create database connections system
-- Description: Tables for managing database connections, members, and invitations
-- Author: Chirag
-- Date: 2025-01-07
-- Rollback: Run ./supabase/scripts/rollback.sh 20250107000004

-- Create enum for database types
CREATE TYPE database_type AS ENUM ('mysql', 'postgresql', 'sqlite', 'supabase');

-- Create enum for user roles in connections
CREATE TYPE connection_role AS ENUM ('owner', 'admin', 'developer', 'tester', 'viewer');

-- Create enum for invitation status
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- Create database_connections table
CREATE TABLE IF NOT EXISTS public.database_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  db_type database_type NOT NULL,

  -- Configuration stored as JSONB for flexibility
  -- Structure varies by database type:
  -- MySQL/PostgreSQL: {host, port, database, username, password, ssl}
  -- SQLite: {file_path}
  -- Supabase: {url, anon_key, service_role_key, db_password}
  config JSONB NOT NULL,

  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create connection_members table (user-connection relationship with roles)
CREATE TABLE IF NOT EXISTS public.connection_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.database_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role connection_role NOT NULL,
  added_by UUID REFERENCES public.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one user has only one role per connection
  UNIQUE(connection_id, user_id)
);

-- Create connection_invitations table
CREATE TABLE IF NOT EXISTS public.connection_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.database_connections(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role connection_role NOT NULL,
  status invitation_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate pending invitations
  CONSTRAINT unique_pending_invitation UNIQUE(connection_id, invited_email, status)
);

-- Create indexes for better performance
CREATE INDEX idx_connections_created_by ON public.database_connections(created_by);
CREATE INDEX idx_connections_db_type ON public.database_connections(db_type);
CREATE INDEX idx_connections_is_active ON public.database_connections(is_active);

CREATE INDEX idx_connection_members_connection ON public.connection_members(connection_id);
CREATE INDEX idx_connection_members_user ON public.connection_members(user_id);
CREATE INDEX idx_connection_members_role ON public.connection_members(role);

CREATE INDEX idx_invitations_connection ON public.connection_invitations(connection_id);
CREATE INDEX idx_invitations_email ON public.connection_invitations(invited_email);
CREATE INDEX idx_invitations_user ON public.connection_invitations(invited_user_id);
CREATE INDEX idx_invitations_status ON public.connection_invitations(status);

-- Enable Row Level Security
ALTER TABLE public.database_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_invitations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is a member of a connection (bypasses RLS)
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

-- Helper function to check if user has specific role in connection (bypasses RLS)
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

-- RLS Policies for database_connections
-- Users can view connections they are members of
CREATE POLICY "Users can view connections they are members of"
  ON public.database_connections
  FOR SELECT
  USING (
    public.user_is_connection_member(id, auth.uid())
  );

-- Only owners and admins can update connections
CREATE POLICY "Owners and admins can update connections"
  ON public.database_connections
  FOR UPDATE
  USING (
    public.user_has_connection_role(id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Authenticated users can create connections
-- Also allows service role to create connections
CREATE POLICY "Authenticated users can create connections"
  ON public.database_connections
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by OR
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Only owners can delete connections
CREATE POLICY "Only owners can delete connections"
  ON public.database_connections
  FOR DELETE
  USING (
    public.user_has_connection_role(id, auth.uid(), ARRAY['owner'])
  );

-- RLS Policies for connection_members
-- Users can view members of connections they belong to
CREATE POLICY "Users can view members of their connections"
  ON public.connection_members
  FOR SELECT
  USING (
    public.user_is_connection_member(connection_id, auth.uid())
  );

-- Owners and admins can add members
CREATE POLICY "Owners and admins can add members"
  ON public.connection_members
  FOR INSERT
  WITH CHECK (
    public.user_has_connection_role(connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Owners and admins can update member roles
CREATE POLICY "Owners and admins can update member roles"
  ON public.connection_members
  FOR UPDATE
  USING (
    public.user_has_connection_role(connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Owners and admins can remove members (but not themselves if they're the last owner)
CREATE POLICY "Owners and admins can remove members"
  ON public.connection_members
  FOR DELETE
  USING (
    public.user_has_connection_role(connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- RLS Policies for connection_invitations
-- Users can view invitations for connections they manage or invitations sent to them
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

-- Owners and admins can create invitations
CREATE POLICY "Owners and admins can create invitations"
  ON public.connection_invitations
  FOR INSERT
  WITH CHECK (
    public.user_has_connection_role(connection_invitations.connection_id, auth.uid(), ARRAY['owner', 'admin'])
  );

-- Users can update invitations sent to them or created by them
CREATE POLICY "Users can update their invitations"
  ON public.connection_invitations
  FOR UPDATE
  USING (
    auth.uid() = invited_by OR
    auth.uid() = invited_user_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.email = connection_invitations.invited_email
    )
  );

-- Service role has full access to all tables
-- Note: Service role should bypass RLS, but we add policies as a safety measure
CREATE POLICY "Service role has full access to connections"
  ON public.database_connections
  FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "Service role has full access to members"
  ON public.connection_members
  FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

CREATE POLICY "Service role has full access to invitations"
  ON public.connection_invitations
  FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Trigger for updated_at on database_connections
CREATE TRIGGER set_updated_at_connections
  BEFORE UPDATE ON public.database_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for updated_at on connection_members
CREATE TRIGGER set_updated_at_members
  BEFORE UPDATE ON public.connection_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for updated_at on connection_invitations
CREATE TRIGGER set_updated_at_invitations
  BEFORE UPDATE ON public.connection_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to automatically add creator as owner when creating a connection
CREATE OR REPLACE FUNCTION public.add_connection_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.connection_members (connection_id, user_id, role, added_by)
  VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically add creator as owner
CREATE TRIGGER on_connection_created
  AFTER INSERT ON public.database_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.add_connection_owner();

-- Function to prevent removing the last owner
CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
  total_member_count INTEGER;
  connection_being_deleted BOOLEAN;
BEGIN
  -- Only check if deleting an owner
  IF OLD.role = 'owner' THEN
    -- Check if the connection is being deleted by checking if it's marked for deletion
    -- We do this by checking if there's a pending deletion in the current transaction
    -- A simpler approach: if we're the only member, allow (connection deletion)
    -- If there are multiple members, check if connection still exists and has other owners
    
    -- Count includes the row being deleted (BEFORE DELETE trigger)
    SELECT COUNT(*) INTO total_member_count
    FROM public.connection_members
    WHERE connection_id = OLD.connection_id;

    -- If this is the only member, allow deletion (connection is being deleted via CASCADE)
    IF total_member_count <= 1 THEN
      RETURN OLD;
    END IF;

    -- Check if connection still exists (if not, it's being deleted)
    SELECT NOT EXISTS (
      SELECT 1 FROM public.database_connections
      WHERE id = OLD.connection_id
    ) INTO connection_being_deleted;

    -- If connection is being deleted, allow member deletion
    IF connection_being_deleted THEN
      RETURN OLD;
    END IF;

    -- Check if there are other owners (excluding the one being deleted)
    SELECT COUNT(*) INTO owner_count
    FROM public.connection_members
    WHERE connection_id = OLD.connection_id
    AND role = 'owner'
    AND id != OLD.id;

    -- Only prevent if this is the last owner and connection still exists with other members
    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of a connection';
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent removing last owner
CREATE TRIGGER check_last_owner_removal
  BEFORE DELETE ON public.connection_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_owner_removal();

-- Function to auto-accept invitation when user signs up
CREATE OR REPLACE FUNCTION public.auto_link_invitations()
RETURNS TRIGGER AS $$
BEGIN
  -- Update pending invitations to link them to the new user
  UPDATE public.connection_invitations
  SET invited_user_id = NEW.id
  WHERE invited_email = NEW.email
  AND invited_user_id IS NULL
  AND status = 'pending'
  AND expires_at > NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to link invitations when user signs up
CREATE TRIGGER on_user_signup_link_invitations
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_invitations();

-- Comments
COMMENT ON TABLE public.database_connections IS 'Database connection configurations';
COMMENT ON TABLE public.connection_members IS 'Users and their roles for each database connection';
COMMENT ON TABLE public.connection_invitations IS 'Pending and historical invitations to database connections';

COMMENT ON COLUMN public.database_connections.config IS 'Database configuration stored as JSON, structure varies by db_type';
COMMENT ON COLUMN public.connection_members.role IS 'User role: owner (full control), admin (manage members), developer (read/write), tester (read/execute), viewer (read-only)';
COMMENT ON COLUMN public.connection_invitations.expires_at IS 'Invitation expiration date, default 7 days from creation';
