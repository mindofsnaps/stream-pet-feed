-- ===========================================================================
-- stream-pet-feed — database setup
--
-- Run this ONCE in the Supabase SQL editor (Dashboard > SQL Editor > New query >
-- paste > Run). It creates everything the app needs:
--   * the `pet_pictures` table (the whole submit -> approve -> feed lifecycle)
--   * the public `pet-pictures` storage bucket (where the photos live)
--   * the service-role grants the app uses to read/write
--
-- Safe to re-run: every step is guarded / idempotent, wrapped in a transaction.
-- The photos live in Supabase Storage (the cloud), NOT on your streaming PC.
-- ===========================================================================

BEGIN;

-- Touch trigger helper: keeps updated_at fresh on every UPDATE. Defined here so
-- this migration is fully self-contained.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS pet_pictures (
  id BIGSERIAL PRIMARY KEY,
  -- Identity. In Twitch mode submitter_id is the Twitch user id; in no-login
  -- mode it's an anonymous browser-cookie id.
  submitter_id TEXT NOT NULL,
  submitter_platform TEXT NOT NULL CHECK (submitter_platform IN ('twitch', 'anon')),
  submitter_name TEXT NOT NULL,              -- display-name snapshot
  -- The pet + image.
  pet_name TEXT NOT NULL,
  on_behalf_of TEXT,                         -- optional: submitting for a friend
  caption TEXT,                              -- optional caption shown on the overlay
  image_path TEXT NOT NULL,                  -- storage object key (pets/<uuid>-<name>)
  image_url TEXT NOT NULL,                   -- permanent public CDN url
  -- Which currency the viewer DECLARED they spent (Twitch mode honor system).
  -- NULL in no-login mode. The CHECK only constrains non-null values.
  spend_kind TEXT CHECK (spend_kind IS NULL OR spend_kind IN ('gifted_sub', 'bits', 'points')),
  spend_verified BOOLEAN NOT NULL DEFAULT FALSE,  -- forward hook (future auto-verify)
  -- Review lifecycle. 'approved' shows on the feed; 'hidden' = pulled from
  -- rotation but kept; 'rejected' = passed on.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Queue (pending, newest first) + feed (approved, by approval time).
CREATE INDEX IF NOT EXISTS idx_pet_pictures_status ON pet_pictures(status);
CREATE INDEX IF NOT EXISTS idx_pet_pictures_feed ON pet_pictures(status, approved_at DESC);
-- The per-pet 30-day submission-limit lookup.
CREATE INDEX IF NOT EXISTS idx_pet_pictures_submitter_pet
  ON pet_pictures(submitter_platform, submitter_id, pet_name, submitted_at DESC);

DROP TRIGGER IF EXISTS pet_pictures_touch ON pet_pictures;
CREATE TRIGGER pet_pictures_touch
  BEFORE UPDATE ON pet_pictures
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS ON, no row policy: every read/write goes through the service-role key
-- (server-side only). A leaked anon/public key reads nothing here. The public
-- feed is served by the server (the /api/pet-feed route), not by anon access.
ALTER TABLE pet_pictures ENABLE ROW LEVEL SECURITY;

-- The service-role key the app uses needs table privileges.
GRANT ALL ON pet_pictures TO service_role;
GRANT USAGE, SELECT ON SEQUENCE pet_pictures_id_seq TO service_role;

-- Storage bucket for the photos: public-read (OBS + the gallery load the CDN
-- url directly). Uploads happen via short-lived signed PUT URLs minted by the
-- service-role client, so no anon storage policy is needed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-pictures', 'pet-pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

COMMIT;

-- Done. Back in the app, the admin queue (/admin/pet-pictures) and the public
-- feed will now work.
