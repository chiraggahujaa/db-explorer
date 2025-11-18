-- Rollback: Create chat history tables
-- Description: Reverses migration 20250116000001_create_chat_tables.sql
-- Author: Claude
-- Date: 2025-01-16

-- Drop policies
DROP POLICY IF EXISTS "Users can update context in their chat sessions" ON chat_context_snapshots;
DROP POLICY IF EXISTS "Users can create context for their chat sessions" ON chat_context_snapshots;
DROP POLICY IF EXISTS "Users can view context from their chat sessions" ON chat_context_snapshots;
DROP POLICY IF EXISTS "Users can update messages in their chat sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages in their chat sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can view messages from their chat sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create their own chat sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can view their own chat sessions" ON chat_sessions;

-- Drop triggers
DROP TRIGGER IF EXISTS update_last_message_at ON chat_messages;
DROP TRIGGER IF EXISTS update_chat_context_snapshots_updated_at ON chat_context_snapshots;
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;

-- Drop functions
DROP FUNCTION IF EXISTS update_chat_session_last_message();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables
DROP TABLE IF EXISTS chat_context_snapshots;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
