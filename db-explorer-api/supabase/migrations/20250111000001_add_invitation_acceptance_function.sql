-- Migration: Add function to accept invitations and add members
-- Description: Create a SECURITY DEFINER function to add connection members when accepting invitations
-- This bypasses RLS policies that would otherwise prevent users from adding themselves
-- Author: System
-- Date: 2025-01-11

-- Function to add a connection member (bypasses RLS)
-- Used when accepting invitations to allow users to add themselves as members
CREATE OR REPLACE FUNCTION public.add_connection_member_via_invitation(
  p_connection_id UUID,
  p_user_id UUID,
  p_role connection_role,
  p_added_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
BEGIN
  -- Insert the member (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.connection_members (
    connection_id,
    user_id,
    role,
    added_by
  )
  VALUES (
    p_connection_id,
    p_user_id,
    p_role,
    p_added_by
  )
  RETURNING id INTO v_member_id;

  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.add_connection_member_via_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_connection_member_via_invitation TO service_role;

COMMENT ON FUNCTION public.add_connection_member_via_invitation IS 'Adds a connection member when accepting an invitation. Bypasses RLS to allow users to add themselves as members.';

