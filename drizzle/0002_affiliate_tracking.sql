CREATE TABLE "conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"network" varchar(24) NOT NULL,
	"order_id" varchar(120) NOT NULL,
	"click_id" varchar(24),
	"program" varchar(40),
	"sale" numeric(12, 2),
	"commission" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "click_id" varchar(24);--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "program" varchar(40);--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "country" varchar(2);--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "host" varchar(80);--> statement-breakpoint
ALTER TABLE "clicks" ADD COLUMN "source" varchar(40);--> statement-breakpoint
CREATE UNIQUE INDEX "conversions_order_idx" ON "conversions" USING btree ("network","order_id");--> statement-breakpoint
CREATE INDEX "conversions_click_idx" ON "conversions" USING btree ("click_id");--> statement-breakpoint
CREATE INDEX "conversions_created_idx" ON "conversions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "clicks_click_id_idx" ON "clicks" USING btree ("click_id");