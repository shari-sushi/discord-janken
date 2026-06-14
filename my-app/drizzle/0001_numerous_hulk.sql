CREATE TABLE "team_day_status" (
	"team_id" uuid NOT NULL,
	"day" date NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_day_status_team_id_day_pk" PRIMARY KEY("team_id","day"),
	CONSTRAINT "team_day_status_status_chk" CHECK ("team_day_status"."status" in ('ok', 'maybe', 'ng'))
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "management_mode" text DEFAULT 'members' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_day_status" ADD CONSTRAINT "team_day_status_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_management_mode_chk" CHECK ("teams"."management_mode" in ('members', 'team'));