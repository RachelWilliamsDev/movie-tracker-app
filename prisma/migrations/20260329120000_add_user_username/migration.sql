-- FEAT-127 (MEM-65): Optional canonical username for social identity.
--
-- Backfill / rollout:
-- - Existing rows keep username NULL; auth and sessions unchanged (email + password unchanged).
-- - Uniqueness applies only when username IS NOT NULL (PostgreSQL UNIQUE allows multiple NULLs).
-- - Application code normalizes on write: trim + lowercase (see normalizeUsernameForDb in src/lib/username.ts).
-- - Enforcing NOT NULL / removing email fallbacks is deferred (FEAT-136, MEM-74).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
