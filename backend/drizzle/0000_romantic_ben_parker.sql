CREATE TYPE "public"."analytics_event_type" AS ENUM('REEL_VIEW', 'RESOURCE_CLICK', 'DOWNLOAD_CLICK', 'PROFILE_VIEW', 'SAVE_REEL');--> statement-breakpoint
CREATE TYPE "public"."creator_plan" AS ENUM('FREE', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."reel_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."reel_visibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('PRODUCT', 'AFFILIATE', 'DOWNLOAD', 'BLOG', 'RECIPE', 'YOUTUBE', 'MAP', 'COUPON', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CREATOR', 'ADMIN');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"reel_id" text,
	"resource_id" text,
	"event_type" "analytics_event_type" NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"referrer" text,
	"country" varchar(2),
	"device_type" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"username" varchar(40) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"instagram_username" varchar(40),
	"avatar_url" text,
	"bio" text,
	"plan" "creator_plan" DEFAULT 'FREE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reels" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"instagram_url" text NOT NULL,
	"instagram_shortcode" varchar(100) NOT NULL,
	"title" varchar(180) NOT NULL,
	"caption" text,
	"thumbnail_url" text,
	"slug" varchar(220) NOT NULL,
	"status" "reel_status" DEFAULT 'DRAFT' NOT NULL,
	"visibility" "reel_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"reel_id" text NOT NULL,
	"type" "resource_type" NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"image_url" text,
	"price" numeric(10, 2),
	"currency" varchar(3),
	"brand" varchar(120),
	"category" varchar(120),
	"position" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'CREATOR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reels" ADD CONSTRAINT "reels_creator_id_creator_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creator_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_reel_id_reels_id_fk" FOREIGN KEY ("reel_id") REFERENCES "public"."reels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_creator_id_idx" ON "analytics_events" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "analytics_reel_id_idx" ON "analytics_events" USING btree ("reel_id");--> statement-breakpoint
CREATE INDEX "analytics_created_at_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_profiles_user_id_idx" ON "creator_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "creator_profiles_username_idx" ON "creator_profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "reels_creator_id_idx" ON "reels" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reels_shortcode_idx" ON "reels" USING btree ("instagram_shortcode");--> statement-breakpoint
CREATE UNIQUE INDEX "reels_slug_idx" ON "reels" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resources_reel_id_idx" ON "resources" USING btree ("reel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");