CREATE TYPE "public"."submission_status" AS ENUM('new', 'researching', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"pair_slug" varchar(160) NOT NULL,
	"side" varchar(16) NOT NULL,
	"retailer" varchar(32) NOT NULL,
	"referrer" text,
	"visitor_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_product" text NOT NULL,
	"alternative_product" text,
	"reason" text,
	"evidence_url" text,
	"email" varchar(320),
	"status" "submission_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"source" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "clicks_pair_idx" ON "clicks" USING btree ("pair_slug");--> statement-breakpoint
CREATE INDEX "clicks_created_idx" ON "clicks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");