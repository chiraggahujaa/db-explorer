-- Migration: Create Notifications System
-- Description: Creates tables for in-app notifications and notification preferences
-- Date: 2025-11-27

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification details
  type VARCHAR(50) NOT NULL,  -- 'job_queued', 'job_started', 'job_completed', 'job_failed', 'invitation_received', 'system', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Optional data payload (job details, links, metadata, etc.)
  data JSONB DEFAULT '{}'::jsonb,

  -- Read status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Auto-delete old notifications

  -- Constraints
  CONSTRAINT check_expires_at_future CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_status ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Comment on table
COMMENT ON TABLE notifications IS 'Stores in-app notifications for users';
COMMENT ON COLUMN notifications.type IS 'Notification type: job_queued, job_started, job_completed, job_failed, invitation_received, system, etc.';
COMMENT ON COLUMN notifications.data IS 'JSONB payload containing additional notification metadata (job_id, connection_id, etc.)';
COMMENT ON COLUMN notifications.expires_at IS 'Timestamp when notification should be auto-deleted';

-- =====================================================
-- NOTIFICATION PREFERENCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Preference settings
  notification_type VARCHAR(50) NOT NULL,  -- 'job_status', 'invitations', 'system', 'chat', etc.
  channel VARCHAR(20) NOT NULL,  -- 'in_app', 'email', 'push'
  enabled BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one preference per user per type per channel
  CONSTRAINT unique_user_type_channel UNIQUE(user_id, notification_type, channel)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_lookup ON notification_preferences(user_id, notification_type, channel, enabled);

-- Comment on table
COMMENT ON TABLE notification_preferences IS 'User preferences for notification delivery channels';
COMMENT ON COLUMN notification_preferences.notification_type IS 'Type of notification: job_status, invitations, system, chat, etc.';
COMMENT ON COLUMN notification_preferences.channel IS 'Delivery channel: in_app, email, push';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp for notification_preferences
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default preferences for the new user
  INSERT INTO notification_preferences (user_id, notification_type, channel, enabled)
  VALUES
    -- Job status notifications
    (NEW.id, 'job_status', 'in_app', true),
    (NEW.id, 'job_status', 'email', true),

    -- Invitation notifications
    (NEW.id, 'invitations', 'in_app', true),
    (NEW.id, 'invitations', 'email', true),

    -- System notifications
    (NEW.id, 'system', 'in_app', true),
    (NEW.id, 'system', 'email', false),

    -- Chat notifications (future)
    (NEW.id, 'chat', 'in_app', true),
    (NEW.id, 'chat', 'email', false)
  ON CONFLICT (user_id, notification_type, channel) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_notification_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Auto-delete expired notifications (cleanup function)
CREATE OR REPLACE FUNCTION delete_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION delete_expired_notifications() IS 'Deletes expired notifications. Should be called periodically via cron job.';

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System (service role) can insert notifications for any user
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Enable RLS on notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can insert default preferences for new users
CREATE POLICY "System can insert notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- GRANTS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, UPDATE ON notification_preferences TO authenticated;

-- Grant all permissions to service role
GRANT ALL ON notifications TO service_role;
GRANT ALL ON notification_preferences TO service_role;
