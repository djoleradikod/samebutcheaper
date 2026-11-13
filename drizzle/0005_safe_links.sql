ALTER TABLE "subscribers" ADD COLUMN "letter_stopped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "confirm_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "confirm_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "wishes" ADD COLUMN "confirm_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "wishes" ADD COLUMN "answered_slug" varchar(160);--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_confirm_idx" ON "subscribers" USING btree ("confirm_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "watches_confirm_idx" ON "watches" USING btree ("confirm_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "wishes_confirm_idx" ON "wishes" USING btree ("confirm_hash");