import type { DxfVerificationResult } from '../shared/cadExport';
import type {
  AccuracyBenchmarkSummary,
  AiAnalysisJob,
  AuthorizedCadCommandSpec,
  BagType,
  BenchmarkSplit,
  BlindTestRecord,
  CaptureGuidanceProfile,
  CommandPlan,
  EdgeProcessType,
  ExportRecord,
  FactoryProductionFeedback,
  FiveEngineSpec,
  ImageAngle,
  IndustryBenchmarkProduct,
  MasterPatternTemplate,
  PatternPiece,
  ProductDimensions,
  Project,
  StructureType,
  StructuredCadCommand,
  TrainingAnnotationStatus,
  TrainingSampleRecord,
  ValidationReport,
} from '../shared/types';

export interface ProjectListItem {
  id: string;
  name: string;
  bagType: BagType;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  dimensions: ProductDimensions;
  thumbnailUrl: string | null;
  componentCount: number;
  patternCount: number;
  validationPassed: boolean;
}

export interface SystemHealthInfo {
  status: string;
  aiModel: string;
  aiConfigured: boolean;
  cadEngine: string;
  intelligenceVersion?: string;
  supportedBagTypes: BagType[];
  masterTemplateCount?: number;
  exportFormats: string[];
}

export interface UserPreferences {
  preferredMaterials?: string[];
  preferredEdgeProcesses?: string[];
  defaultSeamAllowanceMm?: number;
  designHabitNotes?: string[];
  memoryConsentEnabled?: boolean;
}

export interface KnowledgeDocItem {
  id: string;
  knowledgeType: string;
  title: string;
  content: string;
  applicableBagTypes: string[];
  applicableMaterials: string[];
  relatedParts: string[];
  source: string;
  version: string;
  confidence: number;
  reviewLevel: number;
  securityScope: string;
  ownerUid: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessRuleItem {
  id: string;
  code: string;
  name: string;
  edgeProcess: string;
  seamAllowanceMm: number;
  foldWidthMm: number;
  skiveEdgeTargetMm: number;
  stitchSpacingMm: number;
  reinforcementAdvice: string;
  source: string;
  reviewLevel: number;
}

export interface ConstructionRuleItem {
  id: string;
  code: string;
  title: string;
  fromPart: string;
  toPart: string;
  relationType: string;
  allowanceMm: number;
  toleranceMm: number;
  ruleDetail: string;
  source: string;
  reviewLevel: number;
}

export interface PatternCaseItem {
  id: string;
  projectId: string | null;
  title: string;
  bagType: string;
  materialId: string;
  edgeProcess: string;
  photoSummary: string;
  dimensionsSummary: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
    handleLengthMm: number;
    seamAllowanceMm: number;
  };
  structureBreakdown: string[];
  processSummary: string;
  validationPassed: boolean;
  productionVerified: boolean;
  productionResultNote: string;
  securityScope: string;
  reviewLevel: number;
  version: string;
  createdAt: string;
}

export interface ExperienceRecordItem {
  id: string;
  bagType: string;
  materialId: string;
  relatedParts: string[];
  errorCategory: string;
  errorLocation: string;
  rootCause: string;
  fixMethod: string;
  geometryPassed: boolean;
  patternMakerReviewed: boolean;
  productionVerified: boolean;
  outcomeSummary: string;
  reviewLevel: number;
  createdAt: string;
}

export interface MemoryItem {
  id: string;
  memoryLayer: string;
  memoryKey: string;
  content: string;
  applicableBagTypes: string[];
  applicableMaterials: string[];
  source: string;
  securityScope: string;
  reviewLevel: number;
  confidence: number;
  mergedCount: number;
  isActive: boolean;
  updatedAt: string;
}

export interface LearningCandidateItem {
  id: string;
  feedbackEventId: string | null;
  knowledgeType: string;
  title: string;
  proposedContent: string;
  applicableBagTypes: string[];
  applicableMaterials: string[];
  relatedParts: string[];
  classification: string;
  source: string;
  version: string;
  confidence: number;
  reviewLevel: number;
  status: string;
  securityScope: string;
  reviewerName?: string | null;
  reviewNote?: string | null;
  promotedKnowledgeId?: string | null;
  createdAt: string;
}

export interface FeedbackEventItem {
  id: string;
  projectId: string;
  userOriginalPrompt: string;
  interpretedTask: string;
  retrievedKnowledgeIds: string[];
  usedCaseIds: string[];
  geometryDiffSummary: string[];
  validationPassed: boolean;
  userAccepted: boolean;
  patternMakerCorrected: boolean;
  correctionClassification?: string | null;
  correctionDetail: string;
  productionResult: string;
  createdAt: string;
}

export interface KnowledgeVersionItem {
  id: string;
  versionTag: string;
  entityType: string;
  entityId: string;
  changeSummary: string;
  reviewerName: string;
  reviewLevel: number;
  createdAt: string;
}

export interface EvalDatasetItem {
  id: string;
  name: string;
  category: string;
  bagType: string;
  inputPrompt: string;
  baselineScore: number;
}

export interface EvalResultItem {
  id: string;
  runId: string;
  knowledgeVersionTag: string;
  modelName: string;
  datasetId: string;
  passed: boolean;
  score: number;
  baselineScore: number;
  regressionDetected: boolean;
  blockedDeployment: boolean;
  details: {
    category: string;
    observedSummary: string;
    expectedSummary: string;
    latencyMs: number;
  };
  createdAt?: string;
}

export interface IntelligenceOverviewResponse {
  knowledgeVersion: string;
  userPreferences: UserPreferences;
  knowledgeDocs: KnowledgeDocItem[];
  processRules: ProcessRuleItem[];
  constructionRules: ConstructionRuleItem[];
  patternCases: PatternCaseItem[];
  experienceRecords: ExperienceRecordItem[];
  memories: MemoryItem[];
  learningCandidates: LearningCandidateItem[];
  feedbackEvents: FeedbackEventItem[];
  knowledgeVersions: KnowledgeVersionItem[];
  evalDatasets: EvalDatasetItem[];
  latestEvalResults: EvalResultItem[];
  blindTests?: BlindTestRecord[];
  customTemplates?: MasterPatternTemplate[];
  factoryFeedbacks?: FactoryProductionFeedback[];
  latestBenchmark?: AccuracyBenchmarkSummary | null;
  trainingSamples?: TrainingSampleRecord[];
}

export interface ArchitectureRoadmapResponse {
  engines: FiveEngineSpec[];
  industryBenchmarks: IndustryBenchmarkProduct[];
  authorizedCadCommands: AuthorizedCadCommandSpec[];
  telemetry: {
    storageBackend: string;
    masterTemplateCount: number;
    authorizedCommandCount: number;
    trainingSampleCount: number;
    verifiedTrainingCount: number;
  };
}

export interface MasterTemplateFilters {
  bagType?: BagType;
  structureType?: StructureType;
  part?: string;
  materialId?: string;
  edgeProcess?: string;
  status?: 'published' | 'draft' | 'archived';
}

export interface EvaluationRunSummary {
  runId: string;
  knowledgeVersionTag: string;
  modelName: string;
  totalTests: number;
  passedCount: number;
  avgScore: number;
  regressionDetected: boolean;
  allowedToDeploy: boolean;
  results: EvalResultItem[];
}

let tokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  tokenProvider = provider;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = tokenProvider ? await tokenProvider() : null;
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export const api = {
  getSystemHealth: () => apiFetch<SystemHealthInfo>('/api/v1/system/health'),

  listMasterTemplates: (filters?: BagType | MasterTemplateFilters) => {
    const params = new URLSearchParams();
    if (typeof filters === 'string' && filters) {
      params.set('bagType', filters);
    } else if (filters && typeof filters === 'object') {
      if (filters.bagType) params.set('bagType', filters.bagType);
      if (filters.structureType) params.set('structureType', filters.structureType);
      if (filters.part) params.set('part', filters.part);
      if (filters.materialId) params.set('materialId', filters.materialId);
      if (filters.edgeProcess) params.set('edgeProcess', filters.edgeProcess);
      if (filters.status) params.set('status', filters.status);
    }
    const qs = params.toString();
    return apiFetch<{ templates: MasterPatternTemplate[] }>(
      qs ? `/api/v1/master-templates?${qs}` : '/api/v1/master-templates'
    );
  },

  createMasterTemplate: (
    payload: Partial<MasterPatternTemplate> & { projectId?: string; dxfText?: string }
  ) =>
    apiFetch<{ template: MasterPatternTemplate }>('/api/v1/master-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMasterTemplate: (id: string, patch: Partial<MasterPatternTemplate>) =>
    apiFetch<{ template: MasterPatternTemplate }>(`/api/v1/master-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  listProjects: () => apiFetch<{ projects: ProjectListItem[] }>('/api/v1/projects'),

  createProject: (payload: {
    name?: string;
    bagType?: BagType;
    templateId?: string;
    images?: Array<{ name: string; angle: ImageAngle; dataUrl: string; mimeType: string }>;
    initialPrompt?: string;
    blankMode?: boolean;
    captureGuidance?: Partial<CaptureGuidanceProfile>;
  }) =>
    apiFetch<{ project: Project }>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getProject: (id: string) => apiFetch<{ project: Project }>(`/api/v1/projects/${id}`),

  deleteProject: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/v1/projects/${id}`, { method: 'DELETE' }),

  updateProject: (
    id: string,
    payload: Partial<Project> & {
      expectedVersion?: number;
      regenerateFromParams?: boolean;
      versionSummary?: string;
    }
  ) =>
    apiFetch<{ project: Project }>(`/api/v1/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  uploadImages: (
    id: string,
    images: Array<{ name: string; angle: ImageAngle; dataUrl: string; mimeType: string }>,
    captureGuidance?: Partial<CaptureGuidanceProfile>
  ) =>
    apiFetch<{ project: Project }>(`/api/v1/projects/${id}/images`, {
      method: 'POST',
      body: JSON.stringify({ images, captureGuidance }),
    }),

  startAnalysis: (
    id: string,
    userBrief: string,
    captureGuidance?: Partial<CaptureGuidanceProfile>
  ) =>
    apiFetch<{ job: AiAnalysisJob }>(`/api/v1/projects/${id}/analysis`, {
      method: 'POST',
      body: JSON.stringify({ userBrief, captureGuidance }),
    }),

  getJob: (jobId: string) => apiFetch<{ job: AiAnalysisJob }>(`/api/v1/jobs/${jobId}`),

  planAiCommand: (id: string, prompt: string) =>
    apiFetch<{ plan: CommandPlan }>(`/api/v1/projects/${id}/ai/command/plan`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),

  executeAiCommand: (
    id: string,
    payload: {
      expectedVersion?: number;
      userPrompt?: string;
      commands: StructuredCadCommand[];
      replyText?: string;
      plan?: CommandPlan;
    }
  ) =>
    apiFetch<{
      project: Project;
      diffSummary: string[];
      rolledBack?: boolean;
      rollbackReason?: string;
    }>(`/api/v1/projects/${id}/ai/command/execute`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateQualitySignoff: (
    id: string,
    payload: {
      patternMakerConfirmed?: boolean;
      patternMakerName?: string;
      physicalSamplePassed?: boolean;
      sampleLotNote?: string;
    }
  ) =>
    apiFetch<{ project: Project }>(`/api/v1/projects/${id}/quality-signoff`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  applyTemplate: (id: string, templateId: string, keepCustomDimensions = false) =>
    apiFetch<{ project: Project; template: MasterPatternTemplate }>(
      `/api/v1/projects/${id}/apply-template`,
      {
        method: 'POST',
        body: JSON.stringify({ templateId, keepCustomDimensions }),
      }
    ),

  calibrateMultiAxis: (
    id: string,
    axes: { widthMm?: number; heightMm?: number; depthMm?: number }
  ) =>
    apiFetch<{ project: Project; diffSummary: string[] }>(
      `/api/v1/projects/${id}/calibrate`,
      {
        method: 'POST',
        body: JSON.stringify(axes),
      }
    ),

  validatePatterns: (id: string, pieceId = 'all') =>
    apiFetch<{ validation: ValidationReport; project: Project }>(
      `/api/v1/projects/${id}/patterns/${pieceId}/validate`,
      { method: 'POST' }
    ),

  saveVersion: (id: string, summary: string) =>
    apiFetch<{ project: Project }>(`/api/v1/projects/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ summary }),
    }),

  restoreVersion: (id: string, version: number) =>
    apiFetch<{ project: Project }>(`/api/v1/projects/${id}/versions/${version}/restore`, {
      method: 'POST',
    }),

  undo: (id: string) =>
    apiFetch<{ project: Project }>(`/api/v1/projects/${id}/undo`, { method: 'POST' }),

  redo: (id: string) =>
    apiFetch<{ project: Project }>(`/api/v1/projects/${id}/redo`, { method: 'POST' }),

  recordExport: (
    id: string,
    format: 'pdf' | 'dxf' | 'svg' | 'json' | 'csv',
    pageFormat?: 'A4' | 'A3' | 'LARGE'
  ) =>
    apiFetch<{ record: ExportRecord; project: Project }>(`/api/v1/projects/${id}/exports`, {
      method: 'POST',
      body: JSON.stringify({ format, pageFormat }),
    }),

  importDxf: (id: string, dxfText: string, replaceExisting = false) =>
    apiFetch<{ verification: DxfVerificationResult; project: Project }>(
      `/api/v1/projects/${id}/import-dxf`,
      {
        method: 'POST',
        body: JSON.stringify({ dxfText, replaceExisting }),
      }
    ),

  // V1.1 RUDA Leather Intelligence APIs
  getIntelligenceOverview: () =>
    apiFetch<IntelligenceOverviewResponse>('/api/v1/intelligence/overview'),

  retrieveMemory: (projectId: string, queryText: string) =>
    apiFetch<{
      userMemories: MemoryItem[];
      engineeringKnowledge: KnowledgeDocItem[];
      similarCases: PatternCaseItem[];
      experienceRecords: ExperienceRecordItem[];
    }>(
      `/api/v1/intelligence/retrieve?projectId=${encodeURIComponent(projectId)}&q=${encodeURIComponent(queryText)}`
    ),

  updatePreferences: (prefs: UserPreferences) =>
    apiFetch<{ preferences: UserPreferences }>('/api/v1/intelligence/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),

  upsertMemory: (payload: {
    memoryLayer?: 'session' | 'user_long_term' | 'project_long_term' | 'engineering_knowledge' | 'historical_experience';
    memoryKey: string;
    content: string;
    applicableBagTypes?: string[];
    applicableMaterials?: string[];
    sourceProjectId?: string;
  }) =>
    apiFetch<{ memory: MemoryItem }>('/api/v1/intelligence/memories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteMemory: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/v1/intelligence/memories/${id}`, {
      method: 'DELETE',
    }),

  reviewLearningCandidate: (
    id: string,
    payload: {
      action: 'approve' | 'reject' | 'promote_level';
      targetReviewLevel?: number;
      securityScope?: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
      reviewNote?: string;
      createEvalCase?: boolean;
    }
  ) =>
    apiFetch<{ candidate: LearningCandidateItem; promotedDoc: KnowledgeDocItem | null }>(
      `/api/v1/intelligence/learning-candidates/${id}/review`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  archiveProjectCase: (
    projectId: string,
    payload: {
      securityScope: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
      productionResultNote: string;
    }
  ) =>
    apiFetch<{ caseItem: PatternCaseItem }>(
      `/api/v1/intelligence/cases/archive/${projectId}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  rollbackKnowledgeVersion: (versionId: string) =>
    apiFetch<{ rolledBackVersion: KnowledgeVersionItem; auditEntry: KnowledgeVersionItem }>(
      `/api/v1/intelligence/versions/${versionId}/rollback`,
      { method: 'POST' }
    ),

  runEvaluationSuite: () =>
    apiFetch<EvaluationRunSummary>('/api/v1/intelligence/evaluations/run', {
      method: 'POST',
    }),

  listBlindTests: () =>
    apiFetch<{ blindTests: BlindTestRecord[] }>('/api/v1/intelligence/blind-tests'),

  createBlindTest: (
    payload: Omit<BlindTestRecord, 'id' | 'createdAt' | 'dimensionErrorMm'>
  ) =>
    apiFetch<{ blindTest: BlindTestRecord }>('/api/v1/intelligence/blind-tests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // V1.2 Factory Feedback & Accuracy Benchmarks
  listProjectFactoryFeedback: (projectId: string) =>
    apiFetch<{ feedbacks: FactoryProductionFeedback[] }>(
      `/api/v1/projects/${projectId}/production-feedback`
    ),

  submitFactoryFeedback: (
    projectId: string,
    payload: Partial<
      Omit<FactoryProductionFeedback, 'id' | 'createdAt' | 'promotedToExperienceId'>
    > & {
      finishedDimensionsMm: { widthMm: number; heightMm: number; depthMm: number };
      conclusion: FactoryProductionFeedback['conclusion'];
    }
  ) =>
    apiFetch<{ feedback: FactoryProductionFeedback; project: Project }>(
      `/api/v1/projects/${projectId}/production-feedback`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  listAllFactoryFeedback: () =>
    apiFetch<{ feedbacks: FactoryProductionFeedback[] }>(
      '/api/v1/intelligence/production-feedback'
    ),

  getAccuracyBenchmark: () =>
    apiFetch<{ benchmark: AccuracyBenchmarkSummary }>('/api/v1/intelligence/benchmarks'),

  runAccuracyBenchmark: () =>
    apiFetch<{ benchmark: AccuracyBenchmarkSummary }>('/api/v1/intelligence/benchmarks/run', {
      method: 'POST',
    }),

  // V1.3 Five-Engine Architecture, Industry Comparison & Training Dataset Workbench
  getArchitectureRoadmap: () =>
    apiFetch<ArchitectureRoadmapResponse>('/api/v1/architecture/roadmap'),

  listTrainingSamples: (filters?: {
    datasetSplit?: BenchmarkSplit;
    annotationStatus?: TrainingAnnotationStatus;
    bagType?: BagType;
  }) => {
    const params = new URLSearchParams();
    if (filters?.datasetSplit) params.set('datasetSplit', filters.datasetSplit);
    if (filters?.annotationStatus) params.set('annotationStatus', filters.annotationStatus);
    if (filters?.bagType) params.set('bagType', filters.bagType);
    const qs = params.toString();
    return apiFetch<{ samples: TrainingSampleRecord[] }>(
      qs ? `/api/v1/training-samples?${qs}` : '/api/v1/training-samples'
    );
  },

  createTrainingSample: (payload: {
    projectId?: string;
    title?: string;
    bagType?: BagType;
    structureType?: StructureType;
    materialId?: string;
    edgeProcess?: EdgeProcessType;
    datasetSplit?: BenchmarkSplit;
    photoAngles?: ImageAngle[];
    hasReferenceCalibration?: boolean;
    referenceObjectType?: string;
    trueDimensionsMm?: { widthMm: number; heightMm: number; depthMm: number };
    visiblePartLabels?: string[];
    hiddenPartLabels?: string[];
    seamBoundaryNotes?: string;
    annotationStatus?: TrainingAnnotationStatus;
    annotatedBy?: string;
    leatherSpecificRulesChecked?: boolean;
    notes?: string;
  }) =>
    apiFetch<{ sample: TrainingSampleRecord }>('/api/v1/training-samples', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTrainingSample: (id: string, patch: Partial<TrainingSampleRecord>) =>
    apiFetch<{ sample: TrainingSampleRecord }>(`/api/v1/training-samples/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  exportTrainingDataset: () =>
    apiFetch<{ jsonl: string; count: number; splits: Record<string, number> }>(
      '/api/v1/training-samples/export'
    ),
};

export type { PatternPiece };
