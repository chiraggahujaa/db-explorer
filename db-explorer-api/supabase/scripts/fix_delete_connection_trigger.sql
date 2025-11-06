-- Fix the prevent_last_owner_removal trigger to allow connection deletion
-- The trigger should allow member deletion when the connection is being deleted
-- When a connection is deleted, all members are deleted via CASCADE

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
  total_member_count INTEGER;
  connection_being_deleted BOOLEAN;
BEGIN
  -- Only check if deleting an owner
  IF OLD.role = 'owner' THEN
    -- Count includes the row being deleted (BEFORE DELETE trigger)
    SELECT COUNT(*) INTO total_member_count
    FROM public.connection_members
    WHERE connection_id = OLD.connection_id;

    -- If this is the only member, allow deletion (connection is being deleted via CASCADE)
    IF total_member_count <= 1 THEN
      RETURN OLD;
    END IF;

    -- Check if connection still exists (if not, it's being deleted)
    -- Note: In a CASCADE delete, the connection row might be deleted before members
    -- So we check if it exists in the current transaction state
    SELECT NOT EXISTS (
      SELECT 1 FROM public.database_connections
      WHERE id = OLD.connection_id
    ) INTO connection_being_deleted;

    -- If connection is being deleted, allow member deletion
    IF connection_being_deleted THEN
      RETURN OLD;
    END IF;

    -- Check if there are other owners (excluding the one being deleted)
    SELECT COUNT(*) INTO owner_count
    FROM public.connection_members
    WHERE connection_id = OLD.connection_id
    AND role = 'owner'
    AND id != OLD.id;

    -- Only prevent if this is the last owner and connection still exists with other members
    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of a connection';
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

