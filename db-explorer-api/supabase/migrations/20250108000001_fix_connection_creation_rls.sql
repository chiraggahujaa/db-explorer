-- Migration: Fix connection creation RLS issue
-- Description: Create a function to bypass RLS when creating connections via service role
-- Author: Chirag
-- Date: 2025-01-08

-- Function to create a connection (bypasses RLS)
-- The trigger 'on_connection_created' will automatically add the creator as owner
CREATE OR REPLACE FUNCTION public.create_database_connection(
  p_name TEXT,
  p_description TEXT,
  p_db_type database_type,
  p_config JSONB,
  p_created_by UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  db_type database_type,
  config JSONB,
  created_by UUID,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
DECLARE
  v_connection_id UUID;
BEGIN
  -- Insert the connection (bypasses RLS due to SECURITY DEFINER)
  -- The trigger will automatically add the creator as owner member
  INSERT INTO public.database_connections (
    name,
    description,
    db_type,
    config,
    created_by,
    is_active
  )
  VALUES (
    p_name,
    p_description,
    p_db_type,
    p_config,
    p_created_by,
    true
  )
  RETURNING database_connections.id INTO v_connection_id;

  -- Return the created connection
  RETURN QUERY
  SELECT
    dc.id,
    dc.name,
    dc.description,
    dc.db_type,
    dc.config,
    dc.created_by,
    dc.is_active,
    dc.created_at,
    dc.updated_at
  FROM public.database_connections dc
  WHERE dc.id = v_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.create_database_connection TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_database_connection TO service_role;

COMMENT ON FUNCTION public.create_database_connection IS 'Creates a database connection and adds the creator as owner. Bypasses RLS for service role operations.';

