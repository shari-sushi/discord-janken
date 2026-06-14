CREATE TABLE "discord_links" (
	"discord_user_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_team_id_user_id_day_pk" PRIMARY KEY("team_id","user_id","day"),
	CONSTRAINT "schedules_status_chk" CHECK ("schedules"."status" in ('ok', 'maybe', 'ng'))
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team_role" text DEFAULT 'individual' NOT NULL,
	"top" boolean DEFAULT false NOT NULL,
	"jungle" boolean DEFAULT false NOT NULL,
	"mid" boolean DEFAULT false NOT NULL,
	"adc" boolean DEFAULT false NOT NULL,
	"support" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id"),
	CONSTRAINT "team_members_team_role_chk" CHECK ("team_members"."team_role" in ('individual', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"team_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"required_count" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_required_count_chk" CHECK ("teams"."required_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discord_links" ADD CONSTRAINT "discord_links_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_team_member_fk" FOREIGN KEY ("team_id","user_id") REFERENCES "public"."team_members"("team_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_discord_links_user" ON "discord_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_schedules_team_day" ON "schedules" USING btree ("team_id","day");--> statement-breakpoint
CREATE INDEX "idx_team_members_user" ON "team_members" USING btree ("user_id");