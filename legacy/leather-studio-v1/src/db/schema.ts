import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core';

// 1. Authenticated Users & User Long-Term Memory Preferences (Layer 2)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  enterpriseId: text('enterprise_id'),
  preferencesJson: jsonb('preferences_json').$type<{
    preferredMaterials?: string[];
    preferredEdgeProcesses?: string[];
    defaultSeamAllowanceMm?: number;
    designHabitNotes?: string[];
    memoryConsentEnabled?: boolean;
  }>().notNull().default({ memoryConsentEnabled: true }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Persistent Bag Projects (Layer 1 Session + Layer 3 Project Long-Term Memory)
export const rudaProjects = pgTable('ruda_projects', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  enterpriseId: text('enterprise_id'),
  securityScope: text('security_scope').notNull().default('C_USER_PRIVATE'),
  name: text('name').notNull(),
  bagType: text('bag_type').notNull(),
  currentVersion: integer('current_version').notNull().default(1),
  validationPassed: boolean('validation_passed').notNull().default(true),
  thumbnailUrl: text('thumbnail_url'),
  sessionContextJson: jsonb('session_context_json').$type<{
    activeTask?: string;
    lastIntent?: string;
    unfinishedPrompts?: string[];
    retrievedMemoryIds?: string[];
    updatedAt?: string;
  }>().notNull().default({}),
  projectDataJson: jsonb('project_data_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== 14 Core V1.1 Engineering & Intelligence Tables ====================

// Table 1: leather_knowledge_documents
export const leatherKnowledgeDocuments = pgTable('leather_knowledge_documents', {
  id: text('id').primaryKey(),
  knowledgeType: text('knowledge_type').notNull(), // process | structure | material | hardware | defect_fix | design_guideline
  title: text('title').notNull(),
  content: text('content').notNull(),
  applicableBagTypes: jsonb('applicable_bag_types').$type<string[]>().notNull().default([]),
  applicableMaterials: jsonb('applicable_materials').$type<string[]>().notNull().default([]),
  relatedParts: jsonb('related_parts').$type<string[]>().notNull().default([]),
  source: text('source').notNull(),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.85),
  reviewLevel: integer('review_level').notNull().default(1), // 1=AI推测, 2=几何验证, 3=用户确认, 4=专业人员审核, 5=实际生产验证
  securityScope: text('security_scope').notNull().default('A_PLATFORM_PUBLIC'), // A_PLATFORM_PUBLIC | B_ENTERPRISE_PRIVATE | C_USER_PRIVATE | D_AI_CANDIDATE
  ownerUid: text('owner_uid'),
  enterpriseId: text('enterprise_id'),
  isActive: boolean('is_active').notNull().default(true),
  supersededById: text('superseded_by_id'),
  embedding: vector('embedding', { dimensions: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('leather_knowledge_docs_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// Table 2: leather_component_catalog
export const leatherComponentCatalog = pgTable('leather_component_catalog', {
  id: text('id').primaryKey(),
  standardType: text('standard_type').notNull().unique(),
  partCodePrefix: text('part_code_prefix').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  defaultSeamAllowanceMm: doublePrecision('default_seam_allowance_mm').notNull().default(5),
  matingEdges: jsonb('mating_edges').$type<string[]>().notNull().default([]),
  applicableBagTypes: jsonb('applicable_bag_types').$type<string[]>().notNull().default([]),
  productionNotes: text('production_notes').notNull(),
  source: text('source').notNull().default('RUDA 标准部件库'),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.95),
  reviewLevel: integer('review_level').notNull().default(4),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table 3: leather_material_library
export const leatherMaterialLibrary = pgTable('leather_material_library', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  thicknessMm: doublePrecision('thickness_mm').notNull(),
  temper: text('temper').notNull(),
  stretchFactor: doublePrecision('stretch_factor').notNull().default(0.02),
  grainRequired: boolean('grain_required').notNull().default(true),
  recommendedEdgeProcess: text('recommended_edge_process').notNull(),
  defaultSeamAllowanceMm: doublePrecision('default_seam_allowance_mm').notNull(),
  defaultFoldWidthMm: doublePrecision('default_fold_width_mm').notNull(),
  stitchSpacingMm: doublePrecision('stitch_spacing_mm').notNull(),
  skivingRecommendedAboveMm: doublePrecision('skiving_recommended_above_mm').notNull(),
  costPerDm2Cny: doublePrecision('cost_per_dm2_cny').notNull().default(6.5),
  description: text('description').notNull(),
  source: text('source').notNull().default('RUDA 皮料工程数据库'),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.95),
  reviewLevel: integer('review_level').notNull().default(5),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table 4: leather_hardware_library
export const leatherHardwareLibrary = pgTable('leather_hardware_library', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  hardwareType: text('hardware_type').notNull(),
  mountWidthMm: doublePrecision('mount_width_mm').notNull(),
  holeDiameterMm: doublePrecision('hole_diameter_mm').notNull(),
  holeSpacingMm: doublePrecision('hole_spacing_mm').notNull().default(0),
  finish: text('finish').notNull(),
  loadRatingKg: doublePrecision('load_rating_kg').notNull().default(15),
  installationNotes: text('installation_notes').notNull(),
  source: text('source').notNull().default('RUDA 五金工程库'),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.95),
  reviewLevel: integer('review_level').notNull().default(5),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table 5: leather_process_rules
export const leatherProcessRules = pgTable('leather_process_rules', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  edgeProcess: text('edge_process').notNull(),
  applicableTempers: jsonb('applicable_tempers').$type<string[]>().notNull().default([]),
  seamAllowanceMm: doublePrecision('seam_allowance_mm').notNull(),
  foldWidthMm: doublePrecision('fold_width_mm').notNull(),
  skiveEdgeTargetMm: doublePrecision('skive_edge_target_mm').notNull(),
  stitchSpacingMm: doublePrecision('stitch_spacing_mm').notNull(),
  reinforcementAdvice: text('reinforcement_advice').notNull(),
  applicableBagTypes: jsonb('applicable_bag_types').$type<string[]>().notNull().default([]),
  applicableMaterials: jsonb('applicable_materials').$type<string[]>().notNull().default([]),
  relatedParts: jsonb('related_parts').$type<string[]>().notNull().default([]),
  source: text('source').notNull(),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.92),
  reviewLevel: integer('review_level').notNull().default(4),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table 6: leather_construction_rules
export const leatherConstructionRules = pgTable('leather_construction_rules', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  fromPart: text('from_part').notNull(),
  toPart: text('to_part').notNull(),
  relationType: text('relation_type').notNull(),
  stitchDirection: text('stitch_direction').notNull(),
  allowanceMm: doublePrecision('allowance_mm').notNull(),
  toleranceMm: doublePrecision('tolerance_mm').notNull().default(1.2),
  ruleDetail: text('rule_detail').notNull(),
  applicableBagTypes: jsonb('applicable_bag_types').$type<string[]>().notNull().default([]),
  applicableMaterials: jsonb('applicable_materials').$type<string[]>().notNull().default([]),
  relatedParts: jsonb('related_parts').$type<string[]>().notNull().default([]),
  source: text('source').notNull(),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.94),
  reviewLevel: integer('review_level').notNull().default(4),
  isActive: boolean('is_active').notNull().default(true),
  embedding: vector('embedding', { dimensions: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('leather_construction_rules_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// Table 7: leather_pattern_cases (Verified Production / Engineering Case Library)
export const leatherPatternCases = pgTable('leather_pattern_cases', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  title: text('title').notNull(),
  bagType: text('bag_type').notNull(),
  materialId: text('material_id').notNull(),
  edgeProcess: text('edge_process').notNull(),
  photoSummary: text('photo_summary').notNull(),
  dimensionsSummary: jsonb('dimensions_summary').$type<{
    widthMm: number;
    heightMm: number;
    depthMm: number;
    handleLengthMm: number;
    seamAllowanceMm: number;
  }>().notNull(),
  structureBreakdown: jsonb('structure_breakdown').$type<string[]>().notNull().default([]),
  componentRelations: jsonb('component_relations').$type<string[]>().notNull().default([]),
  nativePatternsSummary: jsonb('native_patterns_summary').$type<Array<{
    partCode: string;
    name: string;
    widthMm: number;
    heightMm: number;
    quantity: number;
  }>>().notNull().default([]),
  processSummary: text('process_summary').notNull(),
  validationPassed: boolean('validation_passed').notNull().default(true),
  productionVerified: boolean('production_verified').notNull().default(false),
  productionResultNote: text('production_result_note').notNull().default(''),
  securityScope: text('security_scope').notNull().default('A_PLATFORM_PUBLIC'),
  ownerUid: text('owner_uid'),
  enterpriseId: text('enterprise_id'),
  source: text('source').notNull().default('RUDA 工程案例归档'),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.9),
  reviewLevel: integer('review_level').notNull().default(4),
  embedding: vector('embedding', { dimensions: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('leather_pattern_cases_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// Table 8: leather_experience_records (Layer 5 Historical Success & Failure Memory)
export const leatherExperienceRecords = pgTable('leather_experience_records', {
  id: text('id').primaryKey(),
  projectId: text('project_id'),
  bagType: text('bag_type').notNull(),
  materialId: text('material_id').notNull(),
  relatedParts: jsonb('related_parts').$type<string[]>().notNull().default([]),
  errorCategory: text('error_category').notNull(), // seam_mismatch | skiving_crack | lining_wrinkle | strap_stretch | zipper_jam | success_pattern
  errorLocation: text('error_location').notNull(),
  rootCause: text('root_cause').notNull(),
  fixMethod: text('fix_method').notNull(),
  geometryPassed: boolean('geometry_passed').notNull().default(false),
  patternMakerReviewed: boolean('pattern_maker_reviewed').notNull().default(false),
  productionVerified: boolean('production_verified').notNull().default(false),
  outcomeSummary: text('outcome_summary').notNull(),
  securityScope: text('security_scope').notNull().default('A_PLATFORM_PUBLIC'),
  ownerUid: text('owner_uid'),
  source: text('source').notNull().default('历史打版经验库'),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.85),
  reviewLevel: integer('review_level').notNull().default(2),
  embedding: vector('embedding', { dimensions: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('leather_experience_records_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// Table 9: ai_memory_items (5-Layer Long-Term Memory Store with Merge / Expiry / Ownership)
export const aiMemoryItems = pgTable('ai_memory_items', {
  id: text('id').primaryKey(),
  memoryLayer: text('memory_layer').notNull(), // session | user_long_term | project_long_term | engineering_knowledge | historical_experience
  memoryKey: text('memory_key').notNull(),
  content: text('content').notNull(),
  applicableBagTypes: jsonb('applicable_bag_types').$type<string[]>().notNull().default([]),
  applicableMaterials: jsonb('applicable_materials').$type<string[]>().notNull().default([]),
  relatedParts: jsonb('related_parts').$type<string[]>().notNull().default([]),
  source: text('source').notNull(),
  sourceProjectId: text('source_project_id'),
  ownerUid: text('owner_uid'),
  enterpriseId: text('enterprise_id'),
  securityScope: text('security_scope').notNull().default('C_USER_PRIVATE'),
  version: text('version').notNull().default('1.0.0'),
  confidence: doublePrecision('confidence').notNull().default(0.8),
  reviewLevel: integer('review_level').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  mergedCount: integer('merged_count').notNull().default(1),
  supersededById: text('superseded_by_id'),
  embedding: vector('embedding', { dimensions: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('ai_memory_items_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

// Table 10: ai_feedback_events (Full 11-point Audit Trail for Every AI CAD Operation & User Correction)
export const aiFeedbackEvents = pgTable('ai_feedback_events', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  ownerUid: text('owner_uid').notNull(),
  userOriginalPrompt: text('user_original_prompt').notNull(),
  interpretedTask: text('interpreted_task').notNull(),
  retrievedKnowledgeIds: jsonb('retrieved_knowledge_ids').$type<string[]>().notNull().default([]),
  usedCaseIds: jsonb('used_case_ids').$type<string[]>().notNull().default([]),
  generatedParameters: jsonb('generated_parameters').$type<Record<string, unknown>>().notNull().default({}),
  cadOperations: jsonb('cad_operations').$type<unknown[]>().notNull().default([]),
  geometryDiffSummary: jsonb('geometry_diff_summary').$type<string[]>().notNull().default([]),
  validationPassed: boolean('validation_passed').notNull().default(true),
  userAccepted: boolean('user_accepted').notNull().default(true),
  patternMakerCorrected: boolean('pattern_maker_corrected').notNull().default(false),
  correctionClassification: text('correction_classification'), // project_specific | user_preference | reusable_experience | general_rule_candidate
  correctionDetail: text('correction_detail').notNull().default(''),
  productionResult: text('production_result').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table 11: ai_learning_candidates (Human-in-the-Loop Review Queue — LEVEL 1 -> LEVEL 5)
export const aiLearningCandidates = pgTable('ai_learning_candidates', {
  id: text('id').primaryKey(),
  feedbackEventId: text('feedback_event_id'),
  knowledgeType: text('knowledge_type').notNull(),
  title: text('title').notNull(),
  proposedContent: text('proposed_content').notNull(),
  applicableBagTypes: jsonb('applicable_bag_types').$type<string[]>().notNull().default([]),
  applicableMaterials: jsonb('applicable_materials').$type<string[]>().notNull().default([]),
  relatedParts: jsonb('related_parts').$type<string[]>().notNull().default([]),
  classification: text('classification').notNull(), // project_specific | user_preference | reusable_experience | general_rule_candidate
  source: text('source').notNull(),
  version: text('version').notNull().default('0.1.0-candidate'),
  confidence: doublePrecision('confidence').notNull().default(0.65),
  reviewLevel: integer('review_level').notNull().default(1), // Always starts at LEVEL 1 (AI Speculation)
  status: text('status').notNull().default('pending'), // pending | approved | rejected | superseded
  securityScope: text('security_scope').notNull().default('D_AI_CANDIDATE'),
  ownerUid: text('owner_uid'),
  reviewerUid: text('reviewer_uid'),
  reviewerName: text('reviewer_name'),
  reviewNote: text('review_note'),
  promotedKnowledgeId: text('promoted_knowledge_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table 12: ai_knowledge_versions (Immutable Version History & Rollback Snapshots)
export const aiKnowledgeVersions = pgTable('ai_knowledge_versions', {
  id: text('id').primaryKey(),
  versionTag: text('version_tag').notNull(),
  entityType: text('entity_type').notNull(), // knowledge_document | process_rule | construction_rule | learning_candidate
  entityId: text('entity_id').notNull(),
  changeSummary: text('change_summary').notNull(),
  previousSnapshot: jsonb('previous_snapshot').$type<Record<string, unknown> | null>(),
  newSnapshot: jsonb('new_snapshot').$type<Record<string, unknown>>().notNull(),
  authorUid: text('author_uid').notNull(),
  reviewerName: text('reviewer_name').notNull(),
  reviewLevel: integer('review_level').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table 13: ai_evaluation_datasets (10-Capability Fixed Regression Benchmark Suite)
export const aiEvaluationDatasets = pgTable('ai_evaluation_datasets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // bag_type | component_id | structure_reasoning | nl_understanding | cad_execution | parametric_linkage | geometry_correctness | seam_matching | material_process | memory_accuracy
  bagType: text('bag_type').notNull(),
  inputPrompt: text('input_prompt').notNull(),
  inputContext: jsonb('input_context').$type<Record<string, unknown>>().notNull().default({}),
  expectedCriteria: jsonb('expected_criteria').$type<{
    expectedIntent?: string;
    expectedDeltaWidthMm?: number;
    expectedMaxSeamDiffMm?: number;
    expectedMinPieces?: number;
    expectedKeywords?: string[];
    expectedMaterialId?: string;
    expectedMemoryMatch?: string;
  }>().notNull(),
  baselineScore: doublePrecision('baseline_score').notNull().default(1.0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table 14: ai_evaluation_results (Regression Gate Results — Blocks Deployment on Regression)
export const aiEvaluationResults = pgTable('ai_evaluation_results', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  knowledgeVersionTag: text('knowledge_version_tag').notNull(),
  modelName: text('model_name').notNull(),
  datasetId: text('dataset_id').notNull(),
  passed: boolean('passed').notNull(),
  score: doublePrecision('score').notNull(),
  baselineScore: doublePrecision('baseline_score').notNull(),
  regressionDetected: boolean('regression_detected').notNull().default(false),
  blockedDeployment: boolean('blocked_deployment').notNull().default(false),
  details: jsonb('details').$type<{
    category: string;
    observedSummary: string;
    expectedSummary: string;
    latencyMs: number;
  }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table 15: leather_embeddings (Unified pgvector Embeddings Index for Construction Rules, Historical Pattern Cases & Engineering Knowledge)
export const leatherEmbeddings = pgTable('leather_embeddings', {
  id: text('id').primaryKey(),
  sourceTable: text('source_table').notNull(), // leather_construction_rules | leather_pattern_cases | leather_knowledge_documents | leather_experience_records
  sourceId: text('source_id').notNull(),
  constructionRuleId: text('construction_rule_id').references(() => leatherConstructionRules.id, {
    onDelete: 'cascade',
  }),
  patternCaseId: text('pattern_case_id').references(() => leatherPatternCases.id, {
    onDelete: 'cascade',
  }),
  title: text('title').notNull(),
  contentText: text('content_text').notNull(),
  applicableBagTypes: jsonb('applicable_bag_types').$type<string[]>().notNull().default([]),
  applicableMaterials: jsonb('applicable_materials').$type<string[]>().notNull().default([]),
  relatedParts: jsonb('related_parts').$type<string[]>().notNull().default([]),
  reviewLevel: integer('review_level').notNull().default(4),
  securityScope: text('security_scope').notNull().default('A_PLATFORM_PUBLIC'),
  ownerUid: text('owner_uid'),
  embeddingModel: text('embedding_model').notNull().default('gemini-embedding-001'),
  dimensions: integer('dimensions').notNull().default(256),
  embedding: vector('embedding', { dimensions: 256 }).notNull(),
  metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('leather_embeddings_vector_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  index('leather_embeddings_source_idx').on(table.sourceTable, table.sourceId),
  index('leather_embeddings_scope_idx').on(table.securityScope, table.ownerUid),
]);

// Table 16: blind_test_records (Unseen Product Photo Blind-Test Evaluation & Production Accuracy Tracking)
export const blindTestRecords = pgTable('blind_test_records', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  title: text('title').notNull(),
  bagType: text('bag_type').notNull(),
  structureType: text('structure_type').notNull(),
  photoCount: integer('photo_count').notNull().default(1),
  actualDimensionsMm: jsonb('actual_dimensions_mm').$type<{ widthMm: number; heightMm: number; depthMm: number }>().notNull(),
  aiInitialDimensionsMm: jsonb('ai_initial_dimensions_mm').$type<{ widthMm: number; heightMm: number; depthMm: number }>().notNull(),
  matchedTemplateId: text('matched_template_id').notNull(),
  aiInitialSummary: text('ai_initial_summary').notNull(),
  manualCorrections: jsonb('manual_corrections').$type<string[]>().notNull().default([]),
  physicalSampleOutcome: text('physical_sample_outcome').notNull().default('pending'),
  dimensionErrorMm: doublePrecision('dimension_error_mm').notNull().default(0),
  maxSeamDiffMm: doublePrecision('max_seam_diff_mm').notNull().default(0),
  completenessScore: doublePrecision('completeness_score').notNull().default(0.85),
  processReasonable: boolean('process_reasonable').notNull().default(true),
  aiRecognitionPassed: boolean('ai_recognition_passed').notNull().default(true),
  geometry2DPassed: boolean('geometry_2d_passed').notNull().default(true),
  seamsAndProcessPassed: boolean('seams_and_process_passed').notNull().default(true),
  physicalProductionPassed: boolean('physical_production_passed').notNull().default(false),
  testerNotes: text('tester_notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table 17: master_pattern_templates (Patternmaker Workbench Custom & Versioned Templates)
export const masterPatternTemplates = pgTable('master_pattern_templates', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  name: text('name').notNull(),
  bagType: text('bag_type').notNull(),
  structureType: text('structure_type').notNull(),
  status: text('status').notNull().default('draft'), // draft | published | archived
  templateVersion: text('template_version').notNull().default('V1.0-CUSTOM'),
  templateJson: jsonb('template_json').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Table 18: factory_production_feedbacks (10-Field Real Sample & Mass Production Feedback)
export const factoryProductionFeedbacks = pgTable('factory_production_feedbacks', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  projectId: text('project_id').notNull(),
  projectName: text('project_name').notNull(),
  projectVersion: integer('project_version').notNull().default(1),
  bagType: text('bag_type').notNull(),
  materialId: text('material_id').notNull(),
  actualCutDeviationMm: doublePrecision('actual_cut_deviation_mm').notNull().default(0),
  stitchingCondition: text('stitching_condition').notNull(),
  seamDeviationMm: doublePrecision('seam_deviation_mm').notNull().default(0),
  materialIssues: text('material_issues').notNull().default('无'),
  skivingIssues: text('skiving_issues').notNull().default('无'),
  pieceDeformation: text('piece_deformation').notNull().default('无变形'),
  finishedDimensionsMm: jsonb('finished_dimensions_mm').$type<{ widthMm: number; heightMm: number; depthMm: number }>().notNull(),
  appearanceRating: integer('appearance_rating').notNull().default(4),
  patternMakerCorrections: jsonb('pattern_maker_corrections').$type<string[]>().notNull().default([]),
  conclusion: text('conclusion').notNull().default('approved_for_mass_production'),
  recordedBy: text('recorded_by').notNull().default('车间主管'),
  promotedToExperienceId: text('promoted_to_experience_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table 19: accuracy_benchmark_runs (Isolated Train / Validation / Sealed-Test Benchmark Results)
export const accuracyBenchmarkRuns = pgTable('accuracy_benchmark_runs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  ownerUid: text('owner_uid').notNull(),
  modelVersion: text('model_version').notNull(),
  datasetVersion: text('dataset_version').notNull(),
  summaryJson: jsonb('summary_json').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Table 20: leather_training_samples (Patternmaker + Developer Curated Vision & Standard Pattern Training Dataset)
export const leatherTrainingSamples = pgTable('leather_training_samples', {
  id: text('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  sourceProjectId: text('source_project_id'),
  title: text('title').notNull(),
  bagType: text('bag_type').notNull(),
  structureType: text('structure_type').notNull(),
  materialId: text('material_id').notNull(),
  edgeProcess: text('edge_process').notNull(),
  datasetSplit: text('dataset_split').notNull().default('train'), // train | validation | sealed_test
  photoAngles: jsonb('photo_angles').$type<string[]>().notNull().default([]),
  photoCount: integer('photo_count').notNull().default(1),
  hasReferenceCalibration: boolean('has_reference_calibration').notNull().default(false),
  referenceObjectType: text('reference_object_type'),
  trueDimensionsMm: jsonb('true_dimensions_mm').$type<{ widthMm: number; heightMm: number; depthMm: number }>().notNull(),
  visiblePartLabels: jsonb('visible_part_labels').$type<string[]>().notNull().default([]),
  hiddenPartLabels: jsonb('hidden_part_labels').$type<string[]>().notNull().default([]),
  seamBoundaryNotes: text('seam_boundary_notes').notNull().default(''),
  verifiedPieceCount: integer('verified_piece_count').notNull().default(0),
  verifiedPatternSummary: jsonb('verified_pattern_summary').$type<Array<{
    partCode: string;
    name: string;
    widthMm: number;
    heightMm: number;
    seamAllowanceMm: number;
    quantity: number;
  }>>().notNull().default([]),
  annotationStatus: text('annotation_status').notNull().default('draft_ai'), // draft_ai | patternmaker_verified | production_golden
  annotatedBy: text('annotated_by').notNull().default('打版师'),
  leatherSpecificRulesChecked: boolean('leather_specific_rules_checked').notNull().default(true),
  notes: text('notes').notNull().default(''),
  embedding: vector('embedding', { dimensions: 256 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('leather_training_samples_embedding_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  index('leather_training_samples_split_idx').on(table.datasetSplit, table.annotationStatus),
]);
