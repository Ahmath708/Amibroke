-- Check-in reframe (docs/unified-financial-model.md §7): persist the per-check-in Haiku
-- reflection so the journey/timeline view can show each month's "coach's note". Additive +
-- idempotent; existing "users manage own check-ins" RLS already covers the new column.
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS reflection TEXT;
