CREATE TYPE "public"."address_label" AS ENUM('home', 'office', 'other');--> statement-breakpoint
CREATE TYPE "public"."delivery_provider" AS ENUM('uber_direct', 'doordash_drive', 'own_driver');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('requested', 'offered', 'assigned', 'at_pickup', 'picked_up', 'at_dropoff', 'delivered', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('applied', 'approved', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."fee_kind" AS ENUM('service_charge', 'mandatory_gratuity', 'packaging_fee', 'large_order_fee');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_type" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('open', 'accepted', 'declined', 'expired', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'completed', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."restaurant_status" AS ENUM('onboarding', 'live', 'paused', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'restaurant_staff', 'driver', 'admin');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" "address_label" NOT NULL,
	"custom_label" text,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"dropoff_instructions" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "delivery_provider" NOT NULL,
	"provider_delivery_id" text,
	"status" "delivery_status" DEFAULT 'requested' NOT NULL,
	"driver_id" uuid,
	"tracking_url" text,
	"provider_quote_cents" bigint,
	"driver_pay_cents" bigint,
	"distance_meters" integer,
	"duration_seconds" integer,
	"batch_id" uuid,
	"proof_photo_url" text,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "driver_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"order_ids" jsonb NOT NULL,
	"distance_meters" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"pay_cents" bigint DEFAULT 0 NOT NULL,
	"pay_per_order" jsonb NOT NULL,
	"status" "offer_status" DEFAULT 'open' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "driver_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"pay_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "driver_trips_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"vehicle" text DEFAULT 'bike' NOT NULL,
	"status" "driver_status" DEFAULT 'applied' NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"location_at" timestamp with time zone,
	"payouts_ready" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "location_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"opens_at" time NOT NULL,
	"closes_at" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"line1" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"delivery_radius_meters" integer DEFAULT 4800 NOT NULL,
	"tax_rate_ppm" integer DEFAULT 0 NOT NULL,
	"prep_minutes" integer DEFAULT 20 NOT NULL,
	"accepting_orders" boolean DEFAULT true NOT NULL,
	"busy_until" timestamp with time zone,
	"pickup_enabled" boolean DEFAULT true NOT NULL,
	"delivery_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"price_cents" bigint DEFAULT 0 NOT NULL,
	"image_url" text,
	"allergens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dietary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"sold_out_until" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_select" smallint DEFAULT 0 NOT NULL,
	"max_select" smallint DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" bigint DEFAULT 0 NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"fulfilment" "fulfilment_type" NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"items" jsonb NOT NULL,
	"dropoff" jsonb,
	"notes" text,
	"food_cents" bigint DEFAULT 0 NOT NULL,
	"service_charge_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"tip_cents" bigint DEFAULT 0 NOT NULL,
	"delivery_cents" bigint DEFAULT 0 NOT NULL,
	"customer_delivery_cents" bigint DEFAULT 0 NOT NULL,
	"restaurant_delivery_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"receipt" jsonb NOT NULL,
	"payments_quote_id" text,
	"payments_order_id" text,
	"delivery_quote" jsonb,
	"idempotency_key" text NOT NULL,
	"placed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_code_unique" UNIQUE("code"),
	CONSTRAINT "orders_payments_order_id_unique" UNIQUE("payments_order_id")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"role" "user_role" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "restaurant_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"kind" "fee_kind" NOT NULL,
	"label" text NOT NULL,
	"rate_bps" integer,
	"fixed_cents" bigint,
	"min_food_cents" bigint,
	"taxable" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_members" (
	"restaurant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_members_restaurant_id_user_id_pk" PRIMARY KEY("restaurant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"cuisine" text,
	"status" "restaurant_status" DEFAULT 'onboarding' NOT NULL,
	"tax_responsibility_accepted_at" timestamp with time zone,
	"delivery_rule" jsonb,
	"delivery_rule_version" integer,
	"payouts_ready" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"role" "user_role" NOT NULL,
	"name" text,
	"email" text,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_offers" ADD CONSTRAINT "driver_offers_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_trips" ADD CONSTRAINT "driver_trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_hours" ADD CONSTRAINT "location_hours_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_group_id_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_fees" ADD CONSTRAINT "restaurant_fees_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD CONSTRAINT "restaurant_members_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_members" ADD CONSTRAINT "restaurant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deliveries_driver" ON "deliveries" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "offers_driver_status" ON "driver_offers" USING btree ("driver_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_batch_accepted" ON "driver_offers" USING btree ("batch_id") WHERE status = 'accepted';--> statement-breakpoint
CREATE INDEX "hours_location" ON "location_hours" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "locations_restaurant" ON "locations" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_restaurant" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "order_events_order" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_customer_idempotency" ON "orders" USING btree ("customer_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_restaurant_status" ON "orders" USING btree ("restaurant_id","status");--> statement-breakpoint
CREATE INDEX "orders_customer" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "otp_phone_role" ON "otp_codes" USING btree ("phone","role");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_role" ON "users" USING btree ("phone","role");