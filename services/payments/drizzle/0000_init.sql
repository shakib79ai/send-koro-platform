CREATE TYPE "public"."delivery_provider" AS ENUM('uber_direct', 'doordash_drive', 'own_driver', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."ledger_state" AS ENUM('pending', 'available', 'owed', 'paid');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('not_started', 'pending', 'restricted', 'active');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('awaiting_payment', 'authorized', 'paid', 'declined', 'payment_failed', 'cancelled', 'refunded', 'partially_refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'owed', 'processing', 'paid', 'failed', 'reversed', 'on_hold');--> statement-breakpoint
CREATE TABLE "delivery_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"rule" jsonb NOT NULL,
	"per_order_cap_cents" bigint,
	"monthly_budget_cents" bigint,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"accepted_by" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"pay_cents" bigint DEFAULT 0 NOT NULL,
	"tip_cents" bigint DEFAULT 0 NOT NULL,
	"amount_cents" bigint DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"stripe_transfer_id" text,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "driver_transfers_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "driver_transfers_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"stripe_account_id" text,
	"onboarding_status" "onboarding_status" DEFAULT 'not_started' NOT NULL,
	"transfers_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_stripe_account_id_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
CREATE TABLE "fulfillments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "delivery_provider" NOT NULL,
	"driver_id" uuid,
	"provider_delivery_id" text,
	"driver_pay_cents" bigint,
	"actual_cost_cents" bigint,
	"tip_cents" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'assigned' NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "fulfillments_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"account" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"state" "ledger_state" DEFAULT 'pending' NOT NULL,
	"ref" text,
	"dedupe_key" text NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'awaiting_payment' NOT NULL,
	"stripe_account_id" text NOT NULL,
	"payment_intent_id" text,
	"charge_id" text,
	"application_fee_id" text,
	"stripe_fee_cents" bigint,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "orders_payment_intent_id_unique" UNIQUE("payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"consent_id" uuid NOT NULL,
	"consent_version" integer NOT NULL,
	"provider" "delivery_provider" NOT NULL,
	"provider_quote_id" text,
	"food_cents" bigint DEFAULT 0 NOT NULL,
	"service_charge_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"tax_recipient" text DEFAULT 'restaurant' NOT NULL,
	"tax_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tip_cents" bigint DEFAULT 0 NOT NULL,
	"delivery_cents" bigint DEFAULT 0 NOT NULL,
	"customer_delivery_cents" bigint DEFAULT 0 NOT NULL,
	"restaurant_delivery_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"application_fee_cents" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"components" jsonb NOT NULL,
	"charge_refund_cents" bigint DEFAULT 0 NOT NULL,
	"application_fee_refund_cents" bigint DEFAULT 0 NOT NULL,
	"stripe_refund_id" text,
	"stripe_fee_refund_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"stripe_account_id" text,
	"onboarding_status" "onboarding_status" DEFAULT 'not_started' NOT NULL,
	"card_payments_active" boolean DEFAULT false NOT NULL,
	"tax_responsibility_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurants_stripe_account_id_unique" UNIQUE("stripe_account_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"account" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_item_id" text NOT NULL,
	"current_price_id" text NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "supplier_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "delivery_provider" NOT NULL,
	"provider_delivery_id" text,
	"quoted_cents" bigint DEFAULT 0 NOT NULL,
	"actual_cents" bigint,
	"tip_cents" bigint DEFAULT 0 NOT NULL,
	"tip_submitted_at" timestamp with time zone,
	"invoice_ref" text,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	CONSTRAINT "supplier_obligations_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "tier_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"period" text NOT NULL,
	"food_sales_cents" bigint DEFAULT 0 NOT NULL,
	"food_refunds_cents" bigint DEFAULT 0 NOT NULL,
	"net_base_cents" bigint NOT NULL,
	"rule_version" text NOT NULL,
	"price_lookup_key" text NOT NULL,
	"price_id" text NOT NULL,
	"invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delivery_consents" ADD CONSTRAINT "delivery_consents_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_transfers" ADD CONSTRAINT "driver_transfers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_transfers" ADD CONSTRAINT "driver_transfers_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillments" ADD CONSTRAINT "fulfillments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_consent_id_delivery_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."delivery_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_obligations" ADD CONSTRAINT "supplier_obligations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_consents_restaurant_version" ON "delivery_consents" USING btree ("restaurant_id","version");--> statement-breakpoint
CREATE INDEX "ledger_restaurant_account_time" ON "ledger_entries" USING btree ("restaurant_id","account","effective_at");--> statement-breakpoint
CREATE INDEX "orders_restaurant_paid" ON "orders" USING btree ("restaurant_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_subject" ON "subscriptions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tier_snapshots_subject_period" ON "tier_snapshots" USING btree ("subject_type","subject_id","period");