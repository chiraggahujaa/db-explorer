-- Rollback: Remove database connections system
-- Description: Reverses migration 20250107000004_create_database_connections.sql
-- Author: Chirag
-- Date: 2025-01-07

-- Drop triggers
DROP TRIGGER IF EXISTS on_user_signup_link_invitations ON public.users;
DROP TRIGGER IF EXISTS check_last_owner_removal ON public.connection_members;
DROP TRIGGER IF EXISTS on_connection_created ON public.database_connections;
DROP TRIGGER IF EXISTS set_updated_at_invitations ON public.connection_invitations;
DROP TRIGGER IF EXISTS set_updated_at_members ON public.connection_members;
DROP TRIGGER IF EXISTS set_updated_at_connections ON public.database_connections;

-- Drop functions
DROP FUNCTION IF EXISTS public.auto_link_invitations();
DROP FUNCTION IF EXISTS public.prevent_last_owner_removal();
DROP FUNCTION IF EXISTS public.add_connection_owner();
DROP FUNCTION IF EXISTS public.user_is_connection_member(UUID, UUID);
DROP FUNCTION IF EXISTS public.user_has_connection_role(UUID, UUID, TEXT[]);

-- Drop tables (cascade will remove all policies, indexes, and constraints)
DROP TABLE IF EXISTS public.connection_invitations CASCADE;
DROP TABLE IF EXISTS public.connection_members CASCADE;
DROP TABLE IF EXISTS public.database_connections CASCADE;

-- Drop enums
DROP TYPE IF EXISTS invitation_status;
DROP TYPE IF EXISTS connection_role;
DROP TYPE IF EXISTS database_type;
