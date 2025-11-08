-- Rollback: Remove connection creation function
-- Description: Reverses migration 20250108000001_fix_connection_creation_rls.sql
-- Author: Chirag
-- Date: 2025-01-08

-- Revoke execute permissions
REVOKE EXECUTE ON FUNCTION public.create_database_connection FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_database_connection FROM service_role;

-- Drop the function
DROP FUNCTION IF EXISTS public.create_database_connection(
  TEXT,
  TEXT,
  database_type,
  JSONB,
  UUID
);

