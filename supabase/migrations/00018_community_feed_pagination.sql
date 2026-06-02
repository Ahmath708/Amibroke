-- Community feed pagination:
-- 1. Materialize reaction_count (sum of the five whitelisted emoji counts) so the
--    feed can ORDER BY it server-side — the JS client can't order by a JSONB sum.
--    Generated STORED column auto-recomputes whenever the reaction trigger updates
--    the reactions JSONB; legacy {fire,cry,skull}-keyed rows resolve to 0.
-- 2. Indexes backing the three keyset-paginated feed tabs (recent / lowest / trending).

ALTER TABLE community_posts ADD COLUMN reaction_count int
  GENERATED ALWAYS AS (
    COALESCE((reactions->>'🔥')::int, 0)
  + COALESCE((reactions->>'😭')::int, 0)
  + COALESCE((reactions->>'💀')::int, 0)
  + COALESCE((reactions->>'💯')::int, 0)
  + COALESCE((reactions->>'😂')::int, 0)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_cp_recent   ON community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cp_lowest   ON community_posts (score ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_cp_trending ON community_posts (reaction_count DESC, created_at DESC);
