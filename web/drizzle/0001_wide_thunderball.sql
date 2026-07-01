CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" text DEFAULT 'edit_persona' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot_block" bigint NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"for_weight" numeric DEFAULT '0' NOT NULL,
	"against_weight" numeric DEFAULT '0' NOT NULL,
	"executed_config_id" uuid,
	"executed_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce" text NOT NULL,
	"address" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "sessions_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"voter_addr" text NOT NULL,
	"weight" numeric NOT NULL,
	"choice" text NOT NULL,
	"signature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_proposal_voter_unique" UNIQUE("proposal_id","voter_addr")
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;