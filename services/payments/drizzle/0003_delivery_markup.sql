ALTER TABLE "quotes" ADD COLUMN "courier_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "payout_markup_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "card_markup_cents" integer DEFAULT 0 NOT NULL;