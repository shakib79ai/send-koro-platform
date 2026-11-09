ALTER TABLE "orders" ADD COLUMN "application_fee_cents" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_share_cents" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "card_country" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "est_delivery_fee_share_cents" bigint DEFAULT 0 NOT NULL;