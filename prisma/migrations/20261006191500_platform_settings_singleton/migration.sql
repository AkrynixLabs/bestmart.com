-- Single-row table: enforce id = 1 and create the row with the agreed defaults.
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_singleton" CHECK ("id" = 1);
INSERT INTO "platform_settings" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
