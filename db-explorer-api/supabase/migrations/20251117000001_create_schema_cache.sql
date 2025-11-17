-- Create schema_cache table for storing pre-trained database schema metadata
CREATE TABLE IF NOT EXISTS connection_schema_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES database_connections(id) ON DELETE CASCADE,
  schema_data JSONB NOT NULL,
  training_status TEXT NOT NULL DEFAULT 'pending' CHECK (training_status IN ('pending', 'training', 'completed', 'failed')),
  training_started_at TIMESTAMPTZ,
  last_trained_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only one cache entry per connection
  UNIQUE(connection_id)
);

-- Create index for faster lookups
CREATE INDEX idx_schema_cache_connection_id ON connection_schema_cache(connection_id);
CREATE INDEX idx_schema_cache_training_status ON connection_schema_cache(training_status);
CREATE INDEX idx_schema_cache_last_trained_at ON connection_schema_cache(last_trained_at);

-- Enable RLS
ALTER TABLE connection_schema_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access schema cache for connections they have access to
CREATE POLICY "Users can view schema cache for their connections"
  ON connection_schema_cache
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM database_connections dc
      WHERE dc.id = connection_schema_cache.connection_id
      AND user_is_connection_member(dc.id)
    )
  );

CREATE POLICY "Users can insert schema cache for their connections"
  ON connection_schema_cache
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM database_connections dc
      WHERE dc.id = connection_schema_cache.connection_id
      AND user_is_connection_member(dc.id)
    )
  );

CREATE POLICY "Users can update schema cache for their connections"
  ON connection_schema_cache
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM database_connections dc
      WHERE dc.id = connection_schema_cache.connection_id
      AND user_is_connection_member(dc.id)
    )
  );

CREATE POLICY "Users can delete schema cache for their connections"
  ON connection_schema_cache
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM database_connections dc
      WHERE dc.id = connection_schema_cache.connection_id
      AND user_is_connection_member(dc.id)
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_schema_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_schema_cache_updated_at
  BEFORE UPDATE ON connection_schema_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_schema_cache_updated_at();

-- Add comments for documentation
COMMENT ON TABLE connection_schema_cache IS 'Stores pre-trained/cached schema metadata for database connections to improve chat context performance';
COMMENT ON COLUMN connection_schema_cache.schema_data IS 'JSONB containing schemas, tables, columns, indexes, foreign keys, and other metadata';
COMMENT ON COLUMN connection_schema_cache.training_status IS 'Current status of schema training: pending, training, completed, failed';
COMMENT ON COLUMN connection_schema_cache.last_trained_at IS 'Timestamp of when schema was last successfully trained';
