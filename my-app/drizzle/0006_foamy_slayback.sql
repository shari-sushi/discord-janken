CREATE TABLE "team_shares" (
	"team_low" uuid NOT NULL,
	"team_high" uuid NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_shares_team_low_team_high_pk" PRIMARY KEY("team_low","team_high"),
	CONSTRAINT "team_shares_order_chk" CHECK ("team_shares"."team_low" < "team_shares"."team_high")
);
--> statement-breakpoint
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_team_low_teams_team_id_fk" FOREIGN KEY ("team_low") REFERENCES "public"."teams"("team_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_team_high_teams_team_id_fk" FOREIGN KEY ("team_high") REFERENCES "public"."teams"("team_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_shares" ADD CONSTRAINT "team_shares_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_team_shares_high" ON "team_shares" USING btree ("team_high");