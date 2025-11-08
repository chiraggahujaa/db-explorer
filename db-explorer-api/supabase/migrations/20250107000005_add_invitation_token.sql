-- Add token column to connection_invitations table
ALTER TABLE public.connection_invitations
ADD COLUMN IF NOT EXISTS token TEXT UNIQUE;

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.connection_invitations(token);

-- Generate tokens for existing invitations (backfill)
-- Using md5(random()::text) concatenated twice for 64-character hex string
UPDATE public.connection_invitations
SET token = md5(random()::text) || md5(random()::text)
WHERE token IS NULL;

-- Make token NOT NULL after backfilling
ALTER TABLE public.connection_invitations
ALTER COLUMN token SET NOT NULL;

-- Add comment
COMMENT ON COLUMN public.connection_invitations.token IS 'Unique secure token for invitation acceptance via link or manual entry';

