export type BagType = 'tote' | 'handbag' | 'shoulder_bag' | 'wallet' | 'cardholder';

export type StructureType =
  | 'independent_gusset_bottom'
  | 'fold_wrap_body'
  | 'zipper_commuter_tote'
  | 'trapezoid_flap_frame'
  | 'boston_piped_shell'
  | 'kelly_accordion_gusset'
  | 'curved_u_gusset'
  | 'saddle_flap_crossbody'
  | 'dart_pleated_hobo'
  | 'bifold_layered_wallet'
  | 'slim_multislot_cardholder';

export type PatternCertificationLevel =
  | 'ai_draft'
  | 'geometry_verified'
  | 'patternmaker_reviewed'
  | 'sample_verified'
  | 'production_standard';

export type DimensionSource =
  | 'user_confirmed'
  | 'ai_estimated'
  | 'scale_calibrated'
  | 'computed';

export type ImageAngle =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'side'
  | 'bottom'
  | 'top'
  | 'interior'
  | 'detail';

export type CaptureMode = 'quick_ai' | 'precision_pattern';

export type QualityCheckStatus = 'pass' | 'warn' | 'fail';

export interface PhotoQualityCheckItem {
  photoId: string;
  name: string;
  angle: ImageAngle;
  widthPx: number;
  heightPx: number;
  lightingScore: number;
  lightingStatus: QualityCheckStatus;
  lightingDetail: string;
  meanLuminance: number;
  uniformityPct: number;
  distortionScore: number;
  distortionStatus: QualityCheckStatus;
  distortionRisk: 'low' | 'medium' | 'high';
  distortionDetail: string;
  sharpnessScore: number;
  rgbCentroid: [number, number, number];
}

export interface BatchCaptureAudit {
  photoCount: number;
  lightingScore: number;
  lightingStatus: QualityCheckStatus;
  distortionScore: number;
  distortionStatus: QualityCheckStatus;
  multiAngleMatchPct: number;
  multiAngleStatus: QualityCheckStatus;
  colorConsistencyPct: number;
  resolutionConsistencyPct: number;
  missingCoreAngles: ImageAngle[];
  missingRecommendedAngles: ImageAngle[];
  meetsStandardPatternRequirements: boolean;
  readinessSummary: string;
  blockingReasons: string[];
  warnings: string[];
  estimatedErrorMm: number;
  checkedAt: string;
}

export interface CaptureGuidanceProfile {
  mode: CaptureMode;
  referenceObjectType?: 'none' | 'calibration_board' | 'credit_card_85_6mm' | 'a4_sheet_297mm' | 'ruler_scale';
  referenceObjectMm?: number;
  perspectiveCorrectionApplied: boolean;
  lensDistortionNote: string;
  estimatedMeasurementErrorMm: number;
  coveredAngles: ImageAngle[];
  missingRecommendedAngles: ImageAngle[];
  qualityInspection?: BatchCaptureAudit;
}

export interface ProductImage {
  id: string;
  name: string;
  angle: ImageAngle;
  dataUrl: string;
  mimeType: string;
  uploadedAt: string;
}

export type MaterialCategory =
  | 'veg_tan'
  | 'box_calf'
  | 'soft_calf'
  | 'pebbled_cowhide'
  | 'lambskin'
  | 'microfiber'
  | 'lining'
  | 'reinforcement';

export type EdgeProcessType =
  | 'raw_burnish'
  | 'edge_paint'
  | 'folded'
  | 'piped'
  | 'bound';

export interface MaterialSpec {
  id: string;
  name: string;
  category: MaterialCategory;
  thicknessMm: number;
  temper: 'soft' | 'medium' | 'firm';
  stretchFactor: number; // 0.0 - 0.15
  reboundFactor?: number; // 0.0 - 1.0 elastic recovery
  stretchDirection?: 'longitudinal_low' | 'isotropic' | 'cross_high';
  foldedEdgeSuitability?: 'excellent' | 'requires_skiving' | 'not_recommended';
  skivedResidualMm?: number;
  grainRequired: boolean;
  recommendedEdgeProcess: EdgeProcessType;
  defaultSeamAllowanceMm: number;
  defaultFoldWidthMm: number;
  stitchSpacingMm: number;
  skivingRecommendedAboveMm: number;
  adhesiveCompatibility?: string;
  liningRecommendation?: string;
  hardwareBackingRule?: string;
  costPerDm2Cny?: number;
  description: string;
}

export interface KnowledgeBaseMeta {
  version: string;
  updatedAt: string;
  sources: string[];
  applicabilityScope: string;
  auditLog: Array<{
    reviewer: string;
    role: string;
    date: string;
    note: string;
  }>;
}

export interface ProcessSchemeSpec {
  id: string;
  name: string;
  edgeProcess: EdgeProcessType;
  applicableTempers: Array<'soft' | 'medium' | 'firm'>;
  seamAllowanceMm: number;
  foldWidthMm: number;
  skiveEdgeTargetMm: number;
  stitchSpacingMm: number;
  reinforcementAdvice: string;
  sourceStandard: string;
}

export interface StandardComponentSpec {
  standardType: string;
  partCodePrefix: string;
  name: string;
  category: ComponentCategory;
  defaultSeamAllowanceMm: number;
  matingEdges: string[];
  productionNotes: string;
}

export interface HardwareSpec {
  id: string;
  name: string;
  type:
    | 'd_ring'
    | 'magnetic_snap'
    | 'zipper'
    | 'rivet'
    | 'turn_lock'
    | 'buckle'
    | 'strap_clip'
    | 'bottom_stud';
  mountWidthMm: number;
  holeDiameterMm: number;
  holeSpacingMm: number;
  quantity: number;
  finish: string;
  notes?: string;
}

export type ComponentCategory =
  | 'body'
  | 'handle'
  | 'strap'
  | 'opening'
  | 'interior'
  | 'edge'
  | 'hardware'
  | 'reinforcement';

export interface ComponentItem {
  id: string;
  partCode: string;
  name: string;
  standardType: string;
  category: ComponentCategory;
  role: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  materialName: string;
  processType: EdgeProcessType;
  confidence: number; // 0..1
  source: DimensionSource;
  isInferredHidden: boolean;
  boundingBox2D?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  confirmed: boolean;
  notes?: string;
}

export interface ComponentRelation {
  id: string;
  fromComponentId: string;
  fromEdgeId: string;
  toComponentId: string;
  toEdgeId: string;
  relationType:
    | 'sew'
    | 'fold'
    | 'rivet'
    | 'hardware_mount'
    | 'lining_attach'
    | 'reinforce';
  stitchDirection: 'face_to_face' | 'lap' | 'edge_to_edge';
  allowanceMm: number;
  notes?: string;
}

export type SegmentType = 'move' | 'line' | 'quad' | 'cubic';

export interface PathNode {
  id: string;
  x: number;
  y: number;
  type: SegmentType;
  cx1?: number;
  cy1?: number;
  cx2?: number;
  cy2?: number;
}

export type SeamType = 'plain' | 'folded' | 'piped' | 'bound' | 'raw';

export interface EdgeRule {
  edgeId: string;
  label: string;
  nodeStartIdx: number;
  nodeEndIdx: number;
  seamType: SeamType;
  allowanceMm: number;
  foldWidthMm: number;
  stitchLineOffsetMm: number;
}

export interface PatternHole {
  id: string;
  x: number;
  y: number;
  diameterMm: number;
  kind: 'stitch' | 'rivet' | 'hardware' | 'buckle';
  label?: string;
}

export interface PatternNotch {
  id: string;
  x: number;
  y: number;
  nx: number; // outward normal x
  ny: number; // outward normal y
  depthMm: number;
  edgeId: string;
  label?: string;
}

export interface FoldLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface PatternPiece {
  id: string;
  componentId: string;
  partCode: string;
  name: string;
  category: ComponentCategory;
  quantity: number;
  materialId: string;
  materialName: string;
  thicknessMm: number;
  canvasX: number;
  canvasY: number;
  rotationDeg: number;
  nodes: PathNode[];
  edges: EdgeRule[];
  seamAllowanceMm: number;
  foldAllowanceMm: number;
  sewContour: Point2D[];
  cutContour: Point2D[];
  stitchContour: Point2D[];
  foldLines: FoldLine[];
  holes: PatternHole[];
  notches: PatternNotch[];
  grainAngleDeg: number;
  boundingBoxMm: { width: number; height: number };
  perimeterMm: number;
  areaMm2: number;
  edgeLengthsMm: Record<string, number>;
  symmetryRule?: 'none' | 'mirror_x' | 'mirror_y' | 'fold_center';
  skivingZones?: Array<{
    edgeId: string;
    targetThicknessMm: number;
    widthMm: number;
  }>;
  layers?: {
    netAndStitch: {
      sewContour: Point2D[];
      stitchContour: Point2D[];
      perimeterMm: number;
    };
    process: {
      edges: EdgeRule[];
      foldLines: FoldLine[];
      holes: PatternHole[];
      notches: PatternNotch[];
      seamAllowanceMm: number;
      foldAllowanceMm: number;
    };
    cut: {
      cutContour: Point2D[];
      grainAngleDeg: number;
      partCode: string;
      quantity: number;
      boundingBoxMm: { width: number; height: number };
    };
  };
  confidence?: number;
  isInferredHidden?: boolean;
  manuallyEdited?: boolean;
  notes?: string;
}

export type GussetStyle = 'straight' | 'curved' | 'tapered';

export interface ProductDimensions {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  handleLengthMm: number;
  handleDropMm: number;
  strapLengthMm: number;
  bottomThicknessMm: number;
  gussetStyle: GussetStyle;
  gussetCurveRadiusMm: number;
  topOpeningCurveMm: number;
  cornerRadiusMm: number;
  seamAllowanceMm: number;
  foldWidthMm: number;
  stitchSpacingMm: number;
  structureType?: StructureType;
  dimensionSource: DimensionSource;
  calibrationNote?: string;
}

export interface EnabledFeatures {
  hasZipperPocket: boolean;
  hasFrontPocket: boolean;
  hasSlipPocket: boolean;
  hasTopZipperFlap: boolean;
  hasBottomBoard: boolean;
  hasShoulderStrap: boolean;
  hasMagneticClosure: boolean;
  hasTurnLock: boolean;
  hasLining: boolean;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  title: string;
  detail: string;
  pieceId?: string;
  pieceName?: string;
  edgeId?: string;
  targetPieceId?: string;
  targetPieceName?: string;
  targetEdgeId?: string;
  currentMm?: number;
  expectedMm?: number;
  diffMm?: number;
  suggestedAction?: string;
  autoFixCommand?: StructuredCadCommand;
}

export interface ValidationReport {
  checkedAt: string;
  passed: boolean;
  errorCount: number;
  warningCount: number;
  checksRun: string[];
  issues: ValidationIssue[];
}

export type OptimizationGoal =
  | 'reduce_waste'
  | 'reduce_seams'
  | 'italian_luxury'
  | 'comfort_handle'
  | 'optimize_zipper';

export type CadCommandIntent =
  | 'resize_product'
  | 'resize_component'
  | 'modify_geometry'
  | 'add_component'
  | 'remove_component'
  | 'change_material'
  | 'calibrate_scale'
  | 'fix_seam_mismatch'
  | 'optimize_pattern'
  | 'apply_nesting'
  | 'undo_last'
  | 'redo_last'
  | 'design_advice'
  | 'run_validation';

export interface StructuredCadCommand {
  intent: CadCommandIntent;
  target: string;
  operation: string;
  parameters: {
    widthMm?: number;
    heightMm?: number;
    depthMm?: number;
    deltaWidthMm?: number;
    deltaHeightMm?: number;
    deltaDepthMm?: number;
    deltaLengthMm?: number;
    bottomThicknessMm?: number;
    gussetStyle?: GussetStyle;
    gussetCurveRadiusMm?: number;
    topOpeningCurveMm?: number;
    cornerRadiusMm?: number;
    componentType?:
      | 'zipper_pocket'
      | 'front_pocket'
      | 'slip_pocket'
      | 'top_zipper_flap'
      | 'bottom_board'
      | 'shoulder_strap'
      | 'magnetic_closure';
    pieceId?: string;
    edgeId?: string;
    targetLengthMm?: number;
    materialId?: string;
    edgeProcess?: EdgeProcessType;
    stitchSpacingMm?: number;
    seamAllowanceMm?: number;
    referenceAxis?: 'width' | 'height' | 'depth';
    actualMm?: number;
    optimizationGoal?: OptimizationGoal;
    hideWidthMm?: number;
    hideHeightMm?: number;
  };
}

export interface DesignOption {
  id: string;
  title: string;
  description: string;
  commands: StructuredCadCommand[];
}

export interface CommandPlan {
  planId: string;
  userPrompt: string;
  summary: string;
  replyText: string;
  needsConfirmation: boolean;
  isDestructiveOrMajor: boolean;
  clarifyingQuestion?: string;
  proposedOptions?: DesignOption[];
  commands: StructuredCadCommand[];
  affectedParts: string[];
  retrievedKnowledgeIds?: string[];
  usedCaseIds?: string[];
  memoryHints?: string[];
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  plan?: CommandPlan;
  planStatus?: 'pending_confirmation' | 'executed' | 'cancelled' | 'advice_only';
  diffSummary?: string[];
}

export interface AiAnalysisJob {
  id: string;
  projectId: string;
  status:
    | 'queued'
    | 'vision_analyzing'
    | 'structure_reasoning'
    | 'pattern_generating'
    | 'validating'
    | 'completed'
    | 'failed';
  progress: number;
  statusMessage: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualitySignoff {
  patternMakerConfirmed: boolean;
  patternMakerName?: string;
  patternMakerAt?: string;
  physicalSamplePassed: boolean;
  sampleLotNote?: string;
  physicalSampleAt?: string;
}

export type DeliveryEdition = 'ai_design_edition' | 'production_standard_edition';

export interface QualityMetricCheck {
  code: string;
  label: string;
  tier: '2d_geometry' | '3d_assembly' | 'production_feasibility';
  passed: boolean;
  metricValue: string;
  toleranceLimit: string;
  affectedPieceCodes: string[];
  detail: string;
}

export interface QualityReportSummary {
  // 4 strictly separated engineering verification states
  geometryVerified: boolean;
  processRuleVerified: boolean;
  patternMakerConfirmed: boolean;
  physicalSamplePassed: boolean;
  // V1.2 Deliverable Split: AI Design Edition vs Production Standard Edition
  deliveryEdition: DeliveryEdition;
  deliveryEditionLabel: string;
  // 5-tier Pattern Certification Level (Section 9)
  certificationLevel: PatternCertificationLevel;
  certificationLabel: string;
  // 3 independent detection tier flags & concrete numeric checks
  tier2DPassed: boolean;
  tier3DAssemblyPassed: boolean;
  tierProductionPassed: boolean;
  detailedMetrics: QualityMetricCheck[];
  // 10 evaluation dimensions
  geometryStatus: string;
  curveContinuityStatus: string;
  componentCompleteness: string;
  seamMatchStatus: string;
  dimensionCalibrationStatus: string;
  seamAllowanceStatus: string;
  cornerRadiusStatus: string;
  notchAndHoleStatus: string;
  materialCompatibilityStatus: string;
  assemblyFeasibilityStatus: string;
  unconfirmedStructures: string[];
  productionRisks: string[];
}

export interface SeamPairDetail {
  relationId: string;
  seamPairId: string;
  fromPieceCode: string;
  fromPieceName: string;
  fromEdgeId: string;
  fromLengthMm: number;
  fromStartPt?: Point2D;
  fromEndPt?: Point2D;
  toPieceCode: string;
  toPieceName: string;
  toEdgeId: string;
  toLengthMm: number;
  toStartPt?: Point2D;
  toEndPt?: Point2D;
  diffMm: number;
  notchCountFrom: number;
  notchCountTo: number;
  stitchDirection: 'face_to_face' | 'lap' | 'edge_to_edge';
  curveCorrespondence: 'straight_to_straight' | 'arc_to_arc' | 'curve_to_straight_ease';
  cornerTreatment: string;
  processAllowanceMm: number;
  withinTolerance: boolean;
}

export interface SurfaceDevelopabilityReport {
  checkedAt: string;
  developableStatus: 'exact_developable' | 'controlled_ease' | 'requires_split_or_dart';
  maxDistortionPct: number;
  reassembly3DResidualMm: number;
  materialStretchLimitPct: number;
  withinMaterialStretchLimit: boolean;
  recommendedStrategy:
    | 'exact_planar_unfold'
    | 'split_multi_panel'
    | 'add_seam_split'
    | 'insert_dart_or_pleat'
    | 'material_stretch_allowance';
  affectedPieces: Array<{
    partCode: string;
    name: string;
    curvatureType: 'planar' | 'single_curved_cylindrical' | 'double_curved_compound';
    unfoldingAlgorithm:
      | 'exact_planar_projection'
      | 'cylindrical_geodesic_unroll'
      | 'segmented_gore_split'
      | 'dart_relieved_unfold';
    estimatedDistortionPct: number;
    mitigationApplied: string;
  }>;
  summary: string;
}

export type ReconstructionStepStatus = 'completed' | 'warning' | 'skipped' | 'failed';

export interface ReconstructionStepResult {
  stepNumber: number;
  stepKey: string;
  title: string;
  phase: 'task1_vision' | 'task2_reasoning' | 'task3_pattern_cad';
  status: ReconstructionStepStatus;
  confidence: number;
  durationMs: number;
  outputSummary: string;
  details?: string[];
  warnings?: string[];
}

export interface MasterPatternTemplate {
  id: string;
  name: string;
  bagType: BagType;
  structureType: StructureType;
  summary: string;
  authorizedSource: string;
  reviewLevel: 4 | 5;
  verifiedBy: string;
  templateVersion?: string;
  status?: 'published' | 'draft' | 'archived';
  isCustom?: boolean;
  sizeSeries?: Array<{ label: string; widthMm: number; heightMm: number; depthMm: number }>;
  defaultDimensions: ProductDimensions;
  defaultMaterialId: string;
  defaultEdgeProcess: EdgeProcessType;
  defaultFeatures: EnabledFeatures;
  pieceCount: number;
  partsSpec: Array<{
    partCode: string;
    standardType: string;
    name: string;
    quantity: number;
    symmetryRule: 'none' | 'mirror_x' | 'mirror_y' | 'fold_center';
    seamAllowanceMm: number;
    foldAllowanceMm: number;
    reinforcement?: string;
  }>;
  relationsSummary: string[];
  hardwareMounts: string[];
  validationBaseline: {
    maxSeamToleranceMm: number;
    requiresSkivingAboveMm: number;
  };
  engineeringArchive?: {
    referencePhotosCount: number;
    structure3DSummary: string;
    skivingAndReinforcementSpec: string;
    productionProcessSpec: string;
    productionVerificationResult: string;
  };
}

export interface FactoryProductionFeedback {
  id: string;
  projectId: string;
  projectName: string;
  projectVersion: number;
  bagType: BagType;
  materialId: string;
  actualCutDeviationMm: number;
  stitchingCondition: string;
  seamDeviationMm: number;
  materialIssues: string;
  skivingIssues: string;
  pieceDeformation: string;
  finishedDimensionsMm: { widthMm: number; heightMm: number; depthMm: number };
  appearanceRating: 1 | 2 | 3 | 4 | 5;
  patternMakerCorrections: string[];
  conclusion:
    | 'approved_for_mass_production'
    | 'needs_pattern_revision'
    | 'material_process_change'
    | 'rejected';
  recordedBy: string;
  promotedToExperienceId?: string;
  createdAt: string;
}

export type BenchmarkSplit = 'train' | 'validation' | 'sealed_test';

export interface AccuracyBenchmarkCase {
  id: string;
  split: BenchmarkSplit;
  bagType: BagType;
  structureType: StructureType;
  productTitle: string;
  targetToleranceMm: number;
  bagTypeRecognitionOk: boolean;
  structureAccuracyPct: number;
  componentCompletenessPct: number;
  dimensionErrorMm: number;
  contourErrorMm: number;
  seamMatchMaxDiffMm: number;
  materialProcessFitPct: number;
  assembly3DResidualMm: number;
  physicalSamplePassed: boolean;
  passedTarget: boolean;
}

export interface AccuracyBenchmarkSummary {
  runId: string;
  modelVersion: string;
  datasetVersion: string;
  executedAt: string;
  splitsSummary: Record<
    BenchmarkSplit,
    {
      count: number;
      passRatePct: number;
      avgDimErrorMm: number;
      avgSeamDiffMm: number;
    }
  >;
  overallMetrics: {
    bagTypeRecognitionPct: number;
    structureAccuracyPct: number;
    componentCompletenessPct: number;
    avgDimensionErrorMm: number;
    avgContourErrorMm: number;
    avgSeamMatchDiffMm: number;
    materialProcessFitPct: number;
    avg3DReassemblyResidualMm: number;
    physicalSamplePassPct: number;
  };
  cases: AccuracyBenchmarkCase[];
}

export interface BlindTestRecord {
  id: string;
  title: string;
  bagType: BagType;
  structureType: StructureType;
  photoCount: number;
  actualDimensionsMm: { widthMm: number; heightMm: number; depthMm: number };
  aiInitialDimensionsMm: { widthMm: number; heightMm: number; depthMm: number };
  matchedTemplateId: string;
  aiInitialSummary: string;
  manualCorrections: string[];
  physicalSampleOutcome: 'passed' | 'minor_adjustment' | 'failed' | 'pending';
  dimensionErrorMm: number;
  maxSeamDiffMm: number;
  completenessScore: number;
  processReasonable: boolean;
  // 4 strictly separated blind-test proofs (V1.2 Final Acceptance)
  aiRecognitionPassed?: boolean;
  geometry2DPassed?: boolean;
  seamsAndProcessPassed?: boolean;
  physicalProductionPassed?: boolean;
  testerNotes: string;
  createdAt: string;
}

export interface HideDefectZone {
  id: string;
  label: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PlacedNestItem {
  pieceId: string;
  partCode: string;
  name: string;
  copyIndex: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated90: boolean;
  grainAligned: boolean;
}

export interface NestingResult {
  hideWidthMm: number;
  hideHeightMm: number;
  usableAreaDm2: number;
  netPiecesAreaDm2: number;
  utilizationPct: number;
  totalPieceCuts: number;
  grainLockedCount: number;
  defectZones: HideDefectZone[];
  placements: PlacedNestItem[];
  unplacedPieces: string[];
  estimatedLeatherCostCny: number;
  estimatedHardwareCostCny: number;
  estimatedTotalMaterialCostCny: number;
  notes: string[];
}

export interface ProjectSnapshot {
  bagType: BagType;
  dimensions: ProductDimensions;
  materialId: string;
  edgeProcess: EdgeProcessType;
  features: EnabledFeatures;
  hardware: HardwareSpec[];
  components: ComponentItem[];
  relations: ComponentRelation[];
  patterns: PatternPiece[];
  validation: ValidationReport;
  qualitySignoff?: QualitySignoff;
}

export interface ProjectVersion {
  version: number;
  timestamp: string;
  summary: string;
  author: 'user' | 'ai';
  snapshot: ProjectSnapshot;
}

export interface ExportRecord {
  id: string;
  format: 'pdf' | 'dxf' | 'svg' | 'json' | 'csv';
  fileName: string;
  createdAt: string;
  pageFormat?: 'A4' | 'A3' | 'LARGE';
  roundTripVerified?: boolean;
  roundTripSummary?: string;
}

export interface VisionAnalysisSummary {
  detectedBagType: BagType;
  detectedStructureType?: StructureType;
  matchedTemplateId?: string;
  matchedTemplateName?: string;
  templateMatchScore?: number;
  competingStructuresConsidered?: Array<{
    structureType: StructureType;
    reasonRejected: string;
  }>;
  confidence: number;
  visualNotes: string;
  observedFeatures: string[];
  detectedSeamsAndBoundaries?: string[];
  uncertainStructures: string[];
  clarifyingQuestion?: string;
  captureGuidance?: CaptureGuidanceProfile;
  perspectiveAssessment?: {
    photoCount: number;
    isSinglePhotoMode: boolean;
    perspectiveRisk: 'low' | 'medium' | 'high';
    perspectiveNote: string;
    multiViewConsistencyNote: string;
  };
  similarCaseComparisons?: Array<{
    caseId: string;
    title: string;
    similarityPct: number;
    dimensionDeltaSummary: string;
    productionVerified: boolean;
  }>;
  reconstructionSteps?: ReconstructionStepResult[];
  analyzedAt: string;
}

export interface Project {
  id: string;
  name: string;
  bagType: BagType;
  structureType?: StructureType;
  matchedTemplateId?: string;
  captureGuidance?: CaptureGuidanceProfile;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  undoStack: ProjectSnapshot[];
  redoStack: ProjectSnapshot[];
  images: ProductImage[];
  visionSummary?: VisionAnalysisSummary;
  dimensions: ProductDimensions;
  materialId: string;
  edgeProcess: EdgeProcessType;
  features: EnabledFeatures;
  hardware: HardwareSpec[];
  components: ComponentItem[];
  relations: ComponentRelation[];
  patterns: PatternPiece[];
  developability?: SurfaceDevelopabilityReport;
  seamPairDetails?: SeamPairDetail[];
  validation: ValidationReport;
  qualitySignoff?: QualitySignoff;
  messages: AiChatMessage[];
  commandLog: Array<{
    id: string;
    timestamp: string;
    command: StructuredCadCommand;
    resultSummary: string;
  }>;
  versions: ProjectVersion[];
  exports: ExportRecord[];
}

export type TrainingAnnotationStatus =
  | 'draft_ai'
  | 'patternmaker_verified'
  | 'production_golden';

export interface TrainingSampleRecord {
  id: string;
  title: string;
  sourceProjectId?: string;
  bagType: BagType;
  structureType: StructureType;
  materialId: string;
  edgeProcess: EdgeProcessType;
  datasetSplit: BenchmarkSplit;
  photoAngles: ImageAngle[];
  photoCount: number;
  hasReferenceCalibration: boolean;
  referenceObjectType?: string;
  trueDimensionsMm: { widthMm: number; heightMm: number; depthMm: number };
  visiblePartLabels: string[];
  hiddenPartLabels: string[];
  seamBoundaryNotes: string;
  verifiedPieceCount: number;
  verifiedPatternSummary: Array<{
    partCode: string;
    name: string;
    widthMm: number;
    heightMm: number;
    seamAllowanceMm: number;
    quantity: number;
  }>;
  annotationStatus: TrainingAnnotationStatus;
  annotatedBy: string;
  leatherSpecificRulesChecked: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiveEngineSpec {
  id: string;
  order: number;
  name: string;
  englishName: string;
  responsibility: string;
  boundaryRule: string;
  currentModules: string[];
  upgradeFocus: string;
}

export interface IndustryBenchmarkProduct {
  id: string;
  name: string;
  category: 'commercial_cad' | 'research_ai';
  primaryStudyFocus: string;
  capabilities: string[];
  productionLimitations: string;
  rudaIntegrationStrategy: string;
  rudaCurrentProgress: 'implemented' | 'partial' | 'roadmap';
  rudaProgressNote: string;
}

export interface AuthorizedCadCommandSpec {
  intent: string;
  operationSummary: string;
  allowedParameters: string[];
  deterministicGuarantees: string;
  rollbackGuard: string;
}
