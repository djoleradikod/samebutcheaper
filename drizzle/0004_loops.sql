CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"record_kind" varchar(8) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"note" varchar(300),
	"country" varchar(2),
	"visitor_hash" varchar(64),
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sends" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_id" integer NOT NULL,
	"kind" varchar(16) NOT NULL,
	"key" varchar(160) NOT NULL,
	"status" varchar(16) DEFAULT 'sending' NOT NULL,
	"provider_id" varchar(80),
	"items" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanted" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" varchar(80) NOT NULL,
	"source" varchar(8) NOT NULL,
	"country" varchar(2) DEFAULT '' NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_id" integer NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"unit" varchar(24) NOT NULL,
	"alt_price" numeric(12, 4) NOT NULL,
	"alt_ppu" numeric(16, 8) NOT NULL,
	"brand_ppu" numeric(16, 8) NOT NULL,
	"savings_pct" numeric(6, 2) NOT NULL,
	"price_checked" varchar(16),
	"confirm_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wishes" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_id" integer NOT NULL,
	"query" varchar(80) NOT NULL,
	"country" varchar(2),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"confirm_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "newsletter" varchar(8) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "letter_confirmed_at" timestamp with time zone;--> statement-breakpoint
-- Everyone on the list before this signed up through the newsletter form, so the letter is what they asked for.
UPDATE "subscribers" SET "newsletter" = CASE "status" WHEN 'confirmed' THEN 'yes' WHEN 'unsubscribed' THEN 'no' ELSE 'pending' END, "letter_confirmed_at" = CASE "status" WHEN 'confirmed' THEN "confirmed_at" END;--> statement-breakpoint
ALTER TABLE "sends" ADD CONSTRAINT "sends_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watches" ADD CONSTRAINT "watches_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_slug_idx" ON "reports" USING btree ("record_kind","slug");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sends_key_idx" ON "sends" USING btree ("subscriber_id","kind","key");--> statement-breakpoint
CREATE INDEX "sends_created_idx" ON "sends" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wanted_key_idx" ON "wanted" USING btree ("query","source","country","day");--> statement-breakpoint
CREATE INDEX "wanted_day_idx" ON "wanted" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "watches_key_idx" ON "watches" USING btree ("subscriber_id","slug");--> statement-breakpoint
CREATE INDEX "watches_status_idx" ON "watches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "wishes_key_idx" ON "wishes" USING btree ("subscriber_id","query");--> statement-breakpoint
CREATE INDEX "wishes_query_idx" ON "wishes" USING btree ("query");