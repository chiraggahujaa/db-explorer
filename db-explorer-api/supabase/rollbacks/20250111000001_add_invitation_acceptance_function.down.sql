-- Rollback: Remove function to accept invitations and add members
-- Description: Drop the SECURITY DEFINER function used for accepting invitations
-- Author: System
-- Date: 2025-01-11

-- Revoke permissions
REVOKE EXECUTE ON FUNCTION public.add_connection_member_via_invitation FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.add_connection_member_via_invitation FROM service_role;

-- Drop the function
DROP FUNCTION IF EXISTS public.add_connection_member_via_invitation(UUID, UUID, connection_role, UUID);

