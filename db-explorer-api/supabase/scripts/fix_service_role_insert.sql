-- Fix service role INSERT policy issue
-- Update the INSERT policy to also allow service role

-- Update the INSERT policy to allow service role
DROP POLICY IF EXISTS "Authenticated users can create connections" ON public.database_connections;

CREATE POLICY "Authenticated users can create connections"
  ON public.database_connections
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by OR
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Also update service role policies to be more robust
DROP POLICY IF EXISTS "Service role has full access to connections" ON public.database_connections;
DROP POLICY IF EXISTS "Service role has full access to members" ON public.connection_members;
DROP POLICY IF EXISTS "Service role has full access to invitations" ON public.connection_invitations;

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
