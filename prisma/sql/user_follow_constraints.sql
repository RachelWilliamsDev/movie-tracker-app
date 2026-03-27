-- FEAT-101 / MEM-41
-- Prevent self-following at the database layer.
ALTER TABLE "UserFollow"
DROP CONSTRAINT IF EXISTS "UserFollow_no_self_follow";

ALTER TABLE "UserFollow"
ADD CONSTRAINT "UserFollow_no_self_follow"
CHECK ("followerId" <> "followingId");
