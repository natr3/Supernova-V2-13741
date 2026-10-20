CREATE TABLE "entries" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'game' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"owner_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"item_key" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY,
	"notes" text DEFAULT '' NOT NULL,
	"settings" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_item" ON "favorites" ("user_id","item_key");