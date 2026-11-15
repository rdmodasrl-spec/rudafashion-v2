CREATE TABLE "ai_evaluation_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"bag_type" text NOT NULL,
	"input_prompt" text NOT NULL,
	"input_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_criteria" jsonb NOT NULL,
	"baseline_score" double precision DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_evaluation_results" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"knowledge_version_tag" text NOT NULL,
	"model_name" text NOT NULL,
	"dataset_id" text NOT NULL,
	"passed" boolean NOT NULL,
	"score" double precision NOT NULL,
	"baseline_score" double precision NOT NULL,
	"regression_detected" boolean DEFAULT false NOT NULL,
	"blocked_deployment" boolean DEFAULT false NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_feedback_events" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"owner_uid" text NOT NULL,
	"user_original_prompt" text NOT NULL,
	"interpreted_task" text NOT NULL,
	"retrieved_knowledge_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"used_case_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cad_operations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geometry_diff_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation_passed" boolean DEFAULT true NOT NULL,
	"user_accepted" boolean DEFAULT true NOT NULL,
	"pattern_maker_corrected" boolean DEFAULT false NOT NULL,
	"correction_classification" text,
	"correction_detail" text DEFAULT '' NOT NULL,
	"production_result" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"version_tag" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"change_summary" text NOT NULL,
	"previous_snapshot" jsonb,
	"new_snapshot" jsonb NOT NULL,
	"author_uid" text NOT NULL,
	"reviewer_name" text NOT NULL,
	"review_level" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_learning_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"feedback_event_id" text,
	"knowledge_type" text NOT NULL,
	"title" text NOT NULL,
	"proposed_content" text NOT NULL,
	"applicable_bag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classification" text NOT NULL,
	"source" text NOT NULL,
	"version" text DEFAULT '0.1.0-candidate' NOT NULL,
	"confidence" double precision DEFAULT 0.65 NOT NULL,
	"review_level" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"security_scope" text DEFAULT 'D_AI_CANDIDATE' NOT NULL,
	"owner_uid" text,
	"reviewer_uid" text,
	"reviewer_name" text,
	"review_note" text,
	"promoted_knowledge_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_memory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"memory_layer" text NOT NULL,
	"memory_key" text NOT NULL,
	"content" text NOT NULL,
	"applicable_bag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"source_project_id" text,
	"owner_uid" text,
	"enterprise_id" text,
	"security_scope" text DEFAULT 'C_USER_PRIVATE' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.8 NOT NULL,
	"review_level" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"merged_count" integer DEFAULT 1 NOT NULL,
	"superseded_by_id" text,
	"embedding" vector(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_component_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"standard_type" text NOT NULL,
	"part_code_prefix" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"default_seam_allowance_mm" double precision DEFAULT 5 NOT NULL,
	"mating_edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_bag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"production_notes" text NOT NULL,
	"source" text DEFAULT 'RUDA 标准部件库' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.95 NOT NULL,
	"review_level" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leather_component_catalog_standard_type_unique" UNIQUE("standard_type")
);
--> statement-breakpoint
CREATE TABLE "leather_construction_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"from_part" text NOT NULL,
	"to_part" text NOT NULL,
	"relation_type" text NOT NULL,
	"stitch_direction" text NOT NULL,
	"allowance_mm" double precision NOT NULL,
	"tolerance_mm" double precision DEFAULT 1.2 NOT NULL,
	"rule_detail" text NOT NULL,
	"applicable_bag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.94 NOT NULL,
	"review_level" integer DEFAULT 4 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"embedding" vector(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"source_table" text NOT NULL,
	"source_id" text NOT NULL,
	"construction_rule_id" text,
	"pattern_case_id" text,
	"title" text NOT NULL,
	"content_text" text NOT NULL,
	"applicable_bag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"review_level" integer DEFAULT 4 NOT NULL,
	"security_scope" text DEFAULT 'A_PLATFORM_PUBLIC' NOT NULL,
	"owner_uid" text,
	"embedding_model" text DEFAULT 'gemini-embedding-001' NOT NULL,
	"dimensions" integer DEFAULT 256 NOT NULL,
	"embedding" vector(256) NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_experience_records" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"bag_type" text NOT NULL,
	"material_id" text NOT NULL,
	"related_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_category" text NOT NULL,
	"error_location" text NOT NULL,
	"root_cause" text NOT NULL,
	"fix_method" text NOT NULL,
	"geometry_passed" boolean DEFAULT false NOT NULL,
	"pattern_maker_reviewed" boolean DEFAULT false NOT NULL,
	"production_verified" boolean DEFAULT false NOT NULL,
	"outcome_summary" text NOT NULL,
	"security_scope" text DEFAULT 'A_PLATFORM_PUBLIC' NOT NULL,
	"owner_uid" text,
	"source" text DEFAULT '历史打版经验库' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.85 NOT NULL,
	"review_level" integer DEFAULT 2 NOT NULL,
	"embedding" vector(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_hardware_library" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hardware_type" text NOT NULL,
	"mount_width_mm" double precision NOT NULL,
	"hole_diameter_mm" double precision NOT NULL,
	"hole_spacing_mm" double precision DEFAULT 0 NOT NULL,
	"finish" text NOT NULL,
	"load_rating_kg" double precision DEFAULT 15 NOT NULL,
	"installation_notes" text NOT NULL,
	"source" text DEFAULT 'RUDA 五金工程库' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.95 NOT NULL,
	"review_level" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_knowledge_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"knowledge_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"applicable_bag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.85 NOT NULL,
	"review_level" integer DEFAULT 1 NOT NULL,
	"security_scope" text DEFAULT 'A_PLATFORM_PUBLIC' NOT NULL,
	"owner_uid" text,
	"enterprise_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"superseded_by_id" text,
	"embedding" vector(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_material_library" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"thickness_mm" double precision NOT NULL,
	"temper" text NOT NULL,
	"stretch_factor" double precision DEFAULT 0.02 NOT NULL,
	"grain_required" boolean DEFAULT true NOT NULL,
	"recommended_edge_process" text NOT NULL,
	"default_seam_allowance_mm" double precision NOT NULL,
	"default_fold_width_mm" double precision NOT NULL,
	"stitch_spacing_mm" double precision NOT NULL,
	"skiving_recommended_above_mm" double precision NOT NULL,
	"cost_per_dm2_cny" double precision DEFAULT 6.5 NOT NULL,
	"description" text NOT NULL,
	"source" text DEFAULT 'RUDA 皮料工程数据库' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.95 NOT NULL,
	"review_level" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_pattern_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"bag_type" text NOT NULL,
	"material_id" text NOT NULL,
	"edge_process" text NOT NULL,
	"photo_summary" text NOT NULL,
	"dimensions_summary" jsonb NOT NULL,
	"structure_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"component_relations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"native_patterns_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"process_summary" text NOT NULL,
	"validation_passed" boolean DEFAULT true NOT NULL,
	"production_verified" boolean DEFAULT false NOT NULL,
	"production_result_note" text DEFAULT '' NOT NULL,
	"security_scope" text DEFAULT 'A_PLATFORM_PUBLIC' NOT NULL,
	"owner_uid" text,
	"enterprise_id" text,
	"source" text DEFAULT 'RUDA 工程案例归档' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.9 NOT NULL,
	"review_level" integer DEFAULT 4 NOT NULL,
	"embedding" vector(256),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leather_process_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"edge_process" text NOT NULL,
	"applicable_tempers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seam_allowance_mm" double precision NOT NULL,
	"fold_width_mm" double precision NOT NULL,
	"skive_edge_target_mm" double precision NOT NULL,
	"stitch_spacing_mm" double precision NOT NULL,
	"reinforcement_advice" text NOT NULL,
	"applicable_bag_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicable_materials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"confidence" double precision DEFAULT 0.92 NOT NULL,
	"review_level" integer DEFAULT 4 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ruda_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_uid" text NOT NULL,
	"enterprise_id" text,
	"security_scope" text DEFAULT 'C_USER_PRIVATE' NOT NULL,
	"name" text NOT NULL,
	"bag_type" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"validation_passed" boolean DEFAULT true NOT NULL,
	"thumbnail_url" text,
	"session_context_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"project_data_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"enterprise_id" text,
	"preferences_json" jsonb DEFAULT '{"memoryConsentEnabled":true}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "leather_embeddings" ADD CONSTRAINT "leather_embeddings_construction_rule_id_leather_construction_rules_id_fk" FOREIGN KEY ("construction_rule_id") REFERENCES "public"."leather_construction_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leather_embeddings" ADD CONSTRAINT "leather_embeddings_pattern_case_id_leather_pattern_cases_id_fk" FOREIGN KEY ("pattern_case_id") REFERENCES "public"."leather_pattern_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_memory_items_embedding_hnsw_idx" ON "ai_memory_items" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "leather_construction_rules_embedding_hnsw_idx" ON "leather_construction_rules" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "leather_embeddings_vector_hnsw_idx" ON "leather_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "leather_embeddings_source_idx" ON "leather_embeddings" USING btree ("source_table","source_id");--> statement-breakpoint
CREATE INDEX "leather_embeddings_scope_idx" ON "leather_embeddings" USING btree ("security_scope","owner_uid");--> statement-breakpoint
CREATE INDEX "leather_experience_records_embedding_hnsw_idx" ON "leather_experience_records" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "leather_knowledge_docs_embedding_hnsw_idx" ON "leather_knowledge_documents" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "leather_pattern_cases_embedding_hnsw_idx" ON "leather_pattern_cases" USING hnsw ("embedding" vector_cosine_ops);