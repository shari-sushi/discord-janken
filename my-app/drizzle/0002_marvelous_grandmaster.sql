ALTER TABLE "team_members" DROP CONSTRAINT "team_members_team_role_chk";--> statement-breakpoint
ALTER TABLE "team_members" ALTER COLUMN "team_role" SET DEFAULT 'member';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_team_members_one_master" ON "team_members" USING btree ("team_id") WHERE "team_members"."team_role" = 'master';--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_role_chk" CHECK ("team_members"."team_role" in ('master', 'admin', 'member'));