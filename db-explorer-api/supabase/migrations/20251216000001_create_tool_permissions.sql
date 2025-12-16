-- Migration: Create AI Tool Permissions System
-- Description: Tables and policies for managing AI tool execution permissions
-- Author: Claude
-- Date: 2025-12-16

-- =====================================================
-- ENUM: permission_scope
-- =====================================================
CREATE TYPE permission_scope AS ENUM ('tool', 'category');

-- =====================================================
-- Table: ai_tool_permissions
-- Description: Stores user permissions for AI tools per database connection
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_tool_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.database_connections(id) ON DELETE CASCADE,

  scope permission_scope NOT NULL DEFAULT 'tool',
  tool_name VARCHAR(255),
  category_name VARCHAR(255),

  allowed BOOLEAN NOT NULL DEFAULT false,
  auto_approve BOOLEAN NOT NULL DEFAULT false,

  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_scope CHECK (
    (scope = 'tool' AND tool_name IS NOT NULL AND category_name IS NULL) OR
    (scope = 'category' AND category_name IS NOT NULL AND tool_name IS NULL)
  ),

  CONSTRAINT unique_user_connection_tool UNIQUE(user_id, connection_id, scope, tool_name, category_name)
);

-- =====================================================
-- Table: ai_tool_permission_requests
-- Description: Stores pending permission requests from AI
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_tool_permission_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.database_connections(id) ON DELETE CASCADE,
  chat_session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,

  tool_name VARCHAR(255) NOT NULL,
  tool_args JSONB,
  context TEXT,

  status VARCHAR(50) DEFAULT 'pending',
  response VARCHAR(50),

  requested_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: ai_tool_audit_log
-- Description: Audit log for all AI tool executions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_tool_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.database_connections(id) ON DELETE CASCADE,
  chat_session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,

  tool_name VARCHAR(255) NOT NULL,
  tool_category VARCHAR(255),
  tool_args JSONB,

  permission_granted BOOLEAN NOT NULL,
  auto_approved BOOLEAN DEFAULT false,
  execution_status VARCHAR(50),
  execution_error TEXT,
  execution_duration_ms INTEGER,

  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX idx_tool_permissions_user_connection ON public.ai_tool_permissions(user_id, connection_id);
CREATE INDEX idx_tool_permissions_scope ON public.ai_tool_permissions(scope, tool_name, category_name);
CREATE INDEX idx_tool_permissions_allowed ON public.ai_tool_permissions(allowed) WHERE allowed = true;

CREATE INDEX idx_permission_requests_user_connection ON public.ai_tool_permission_requests(user_id, connection_id);
CREATE INDEX idx_permission_requests_status ON public.ai_tool_permission_requests(status) WHERE status = 'pending';
CREATE INDEX idx_permission_requests_chat_session ON public.ai_tool_permission_requests(chat_session_id);

CREATE INDEX idx_audit_log_user_connection ON public.ai_tool_audit_log(user_id, connection_id);
CREATE INDEX idx_audit_log_tool ON public.ai_tool_audit_log(tool_name);
CREATE INDEX idx_audit_log_executed_at ON public.ai_tool_audit_log(executed_at DESC);

-- =====================================================
-- Enable Row Level Security
-- =====================================================
ALTER TABLE public.ai_tool_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_permission_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_audit_log ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies: ai_tool_permissions
-- =====================================================
CREATE POLICY "Users can view their own tool permissions"
  ON public.ai_tool_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tool permissions"
  ON public.ai_tool_permissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tool permissions"
  ON public.ai_tool_permissions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tool permissions"
  ON public.ai_tool_permissions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to permissions"
  ON public.ai_tool_permissions FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- =====================================================
-- RLS Policies: ai_tool_permission_requests
-- =====================================================
CREATE POLICY "Users can view their own permission requests"
  ON public.ai_tool_permission_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own permission requests"
  ON public.ai_tool_permission_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own permission requests"
  ON public.ai_tool_permission_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to requests"
  ON public.ai_tool_permission_requests FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- =====================================================
-- RLS Policies: ai_tool_audit_log
-- =====================================================
CREATE POLICY "Users can view their own audit log"
  ON public.ai_tool_audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to audit log"
  ON public.ai_tool_audit_log FOR ALL
  USING (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  )
  WITH CHECK (
    auth.jwt()->>'role' = 'service_role' OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- =====================================================
-- Triggers for updated_at
-- =====================================================
CREATE TRIGGER set_updated_at_tool_permissions
  BEFORE UPDATE ON public.ai_tool_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to check if user has permission for a specific tool
CREATE OR REPLACE FUNCTION public.user_has_tool_permission(
  p_user_id UUID,
  p_connection_id UUID,
  p_tool_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
  v_tool_category VARCHAR;
BEGIN
  SELECT allowed INTO v_has_permission
  FROM public.ai_tool_permissions
  WHERE user_id = p_user_id
    AND connection_id = p_connection_id
    AND scope = 'tool'
    AND tool_name = p_tool_name
    AND allowed = true
  LIMIT 1;

  IF v_has_permission IS NOT NULL AND v_has_permission THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user has permission for a category
CREATE OR REPLACE FUNCTION public.user_has_category_permission(
  p_user_id UUID,
  p_connection_id UUID,
  p_category_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT allowed INTO v_has_permission
  FROM public.ai_tool_permissions
  WHERE user_id = p_user_id
    AND connection_id = p_connection_id
    AND scope = 'category'
    AND category_name = p_category_name
    AND allowed = true
  LIMIT 1;

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to update usage statistics
CREATE OR REPLACE FUNCTION public.update_tool_permission_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.permission_granted THEN
    UPDATE public.ai_tool_permissions
    SET
      usage_count = usage_count + 1,
      last_used_at = NEW.executed_at
    WHERE user_id = NEW.user_id
      AND connection_id = NEW.connection_id
      AND scope = 'tool'
      AND tool_name = NEW.tool_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_permission_usage
  AFTER INSERT ON public.ai_tool_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tool_permission_usage();

-- Function to auto-expire old permission requests
CREATE OR REPLACE FUNCTION public.expire_old_permission_requests()
RETURNS void AS $$
BEGIN
  UPDATE public.ai_tool_permission_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.ai_tool_permissions IS 'Stores user permissions for AI database tools per connection';
COMMENT ON TABLE public.ai_tool_permission_requests IS 'Pending permission requests from AI requiring user approval';
COMMENT ON TABLE public.ai_tool_audit_log IS 'Audit log of all AI tool executions';

COMMENT ON COLUMN public.ai_tool_permissions.scope IS 'Permission scope: tool (individual tool) or category (all tools in category)';
COMMENT ON COLUMN public.ai_tool_permissions.auto_approve IS 'If true, automatically approve this tool without prompting';
COMMENT ON COLUMN public.ai_tool_audit_log.permission_granted IS 'Whether permission was granted for execution';
