CREATE TABLE "app_state" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "token" varchar(64);--> statement-breakpoint
-- Sign-ups from before double opt-in get a link token too, so they can confirm and unsubscribe.
UPDATE "subscribers" SET "token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') WHERE "token" IS NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "country" varchar(2);--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "confirm_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "unsubscribed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_token_idx" ON "subscribers" USING btree ("token");--> statement-breakpoint
CREATE INDEX "subscribers_status_idx" ON "subscribers" USING btree ("status");