CREATE TABLE "schedule_notifications" (
	"team_id" uuid NOT NULL,
	"day" date NOT NULL,
	"kind" text DEFAULT 'activity_reached' NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_notifications_team_id_day_kind_pk" PRIMARY KEY("team_id","day","kind")
);
--> statement-breakpoint
CREATE TABLE "team_webhooks" (
	"team_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"provider" text DEFAULT 'discord' NOT NULL,
	"webhook_url" text NOT NULL,
	"notify_activity_reached" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_webhooks_team_id_slot_pk" PRIMARY KEY("team_id","slot"),
	CONSTRAINT "team_webhooks_slot_chk" CHECK ("team_webhooks"."slot" in ('own', 'shared')),
	CONSTRAINT "team_webhooks_provider_chk" CHECK ("team_webhooks"."provider" in ('discord'))
);
--> statement-breakpoint
ALTER TABLE "schedule_notifications" ADD CONSTRAINT "schedule_notifications_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_webhooks" ADD CONSTRAINT "team_webhooks_team_id_teams_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("team_id") ON DELETE cascade ON UPDATE no action;