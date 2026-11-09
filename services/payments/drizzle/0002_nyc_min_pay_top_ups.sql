CREATE TABLE "driver_top_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"week_start" text NOT NULL,
	"trip_seconds" integer NOT NULL,
	"minimum_cents" bigint DEFAULT 0 NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"amount_cents" bigint DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"stripe_transfer_id" text,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_top_ups_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "driver_top_ups" ADD CONSTRAINT "driver_top_ups_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_top_ups_driver_week" ON "driver_top_ups" USING btree ("driver_id","week_start");