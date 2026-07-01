CREATE TABLE "agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"hash" text NOT NULL,
	"persona" text NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"voice" text DEFAULT 'default' NOT NULL,
	"avatar_ref" text NOT NULL,
	"anchored_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"creator_addr" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_config_id" uuid,
	"token_address" text,
	"sale_address" text,
	"avatar_token_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;