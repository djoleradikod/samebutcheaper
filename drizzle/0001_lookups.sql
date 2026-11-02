CREATE TABLE "lookups" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(16) NOT NULL,
	"query" varchar(200),
	"source" varchar(16),
	"source_id" varchar(80),
	"product_name" varchar(200),
	"verified" boolean DEFAULT false NOT NULL,
	"country" varchar(2),
	"visitor_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "lookups_created_idx" ON "lookups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "lookups_verified_idx" ON "lookups" USING btree ("verified");