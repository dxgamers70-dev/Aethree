ALTER TABLE "agent_configs" ADD COLUMN "skill_name" text;--> statement-breakpoint
ALTER TABLE "agent_configs" ADD COLUMN "skill_description" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "llm_provider" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "llm_base_url" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "llm_model" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "llm_api_key" text;