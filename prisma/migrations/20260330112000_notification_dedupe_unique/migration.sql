-- MEM-106: DB-enforced idempotency for logical notification events.

CREATE UNIQUE INDEX "Notification_userId_actorId_type_entityId_key"
ON "Notification"("userId", "actorId", "type", "entityId");
