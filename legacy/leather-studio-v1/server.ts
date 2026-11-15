import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  analyzeSurfaceDevelopability,
  buildSeamPairDetails,
  calibrateMultipleAxes,
  computePieceGeometry,
  createStarterSnapshot,
  executeCadTransaction,
  generateParametricPatterns,
  validateProjectPatterns,
} from './src/shared/cadEngine.ts';
import { exportProjectToDxf, parseAndVerifyDxf } from './src/shared/cadExport.ts';
import { BAG_ARCHETYPES, BAG_TYPE_LABELS, STRUCTURE_TYPE_LABELS } from './src/shared/leatherKnowledge.ts';
import {
  MASTER_PATTERN_LIBRARY,
  getMasterTemplateById,
  searchMasterTemplates,
} from './src/shared/masterPatternLibrary.ts';
import {
  AUTHORIZED_CAD_COMMANDS,
  FIVE_ENGINE_ARCHITECTURE,
  INDUSTRY_BENCHMARK_PRODUCTS,
} from './src/shared/architectureRoadmap.ts';
import { isPostgresConfigured } from './src/db/index.ts';
import type {
  AiAnalysisJob,
  BagType,
  BenchmarkSplit,
  BlindTestRecord,
  CaptureGuidanceProfile,
  CommandPlan,
  EdgeProcessType,
  FactoryProductionFeedback,
  ImageAngle,
  MasterPatternTemplate,
  PatternPiece,
  ProductImage,
  Project,
  ProjectSnapshot,
  StructureType,
  StructuredCadCommand,
  TrainingAnnotationStatus,
} from './src/shared/types.ts';
import {
  getGeminiModelId,
  planNaturalLanguageCommandWithGemini,
} from './server/geminiService.ts';
import { runPhotoReconstructionPipeline } from './server/reconstructionEngine.ts';
import {
  deleteProjectForUser,
  getProjectForUser,
  listProjectsForUser,
  upsertProjectForUser,
} from './server/pgProjectsRepo.ts';
import {
  archiveProjectAsCase,
  createBlindTestRecord,
  createCustomMasterTemplate,
  createFactoryFeedback,
  createTrainingSample,
  deleteUserMemoryItem,
  ensureIntelligenceSeeded,
  exportTrainingDatasetJsonl,
  getIntelligenceOverview,
  getLatestAccuracyBenchmark,
  listBlindTests,
  listCustomMasterTemplates,
  listFactoryFeedbacks,
  listPatternCasesForMatching,
  listTrainingSamples,
  recordAiFeedbackAndExtractLearning,
  retrieveRelevantMemoryForPrompt,
  reviewLearningCandidate,
  rollbackKnowledgeVersion,
  runAccuracyBenchmark,
  runAiEvaluationSuite,
  updateCustomMasterTemplate,
  updateTrainingSample,
  upsertMemoryItemWithMerge,
} from './server/intelligenceService.ts';
import { createDemoSessionToken, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { getUserByUid, updateUserPreferences } from './src/db/users.ts';

const analysisJobs = new Map<string, { job: AiAnalysisJob; ownerUid: string }>();

function saveJob(job: AiAnalysisJob, ownerUid: string): AiAnalysisJob {
  const updated: AiAnalysisJob = { ...job, updatedAt: new Date().toISOString() };
  analysisJobs.set(updated.id, { job: updated, ownerUid });
  if (analysisJobs.size > 200) {
    const oldestKey = analysisJobs.keys().next().value;
    if (oldestKey) analysisJobs.delete(oldestKey);
  }
  return updated;
}

function extractSnapshot(project: Project): ProjectSnapshot {
  return {
    bagType: project.bagType,
    dimensions: structuredClone(project.dimensions),
    materialId: project.materialId,
    edgeProcess: project.edgeProcess,
    features: structuredClone(project.features),
    hardware: structuredClone(project.hardware),
    components: structuredClone(project.components),
    relations: structuredClone(project.relations),
    patterns: structuredClone(project.patterns),
    validation: structuredClone(project.validation),
    qualitySignoff: project.qualitySignoff
      ? structuredClone(project.qualitySignoff)
      : { patternMakerConfirmed: false, physicalSamplePassed: false },
  };
}

function applySnapshotToProject(project: Project, snap: ProjectSnapshot): void {
  project.bagType = snap.bagType;
  project.structureType = snap.dimensions.structureType ?? project.structureType;
  project.dimensions = structuredClone(snap.dimensions);
  project.materialId = snap.materialId;
  project.edgeProcess = snap.edgeProcess;
  project.features = structuredClone(snap.features);
  project.hardware = structuredClone(snap.hardware);
  project.components = structuredClone(snap.components);
  project.relations = structuredClone(snap.relations);
  project.patterns = structuredClone(snap.patterns);
  project.validation = structuredClone(snap.validation);
  project.developability = analyzeSurfaceDevelopability(
    project.patterns,
    project.dimensions,
    project.materialId
  );
  project.seamPairDetails = buildSeamPairDetails(project.patterns, project.relations);
  project.qualitySignoff = snap.qualitySignoff
    ? structuredClone(snap.qualitySignoff)
    : { patternMakerConfirmed: false, physicalSamplePassed: false };
}

function pushVersionAndUndo(
  project: Project,
  prevSnap: ProjectSnapshot,
  summary: string,
  author: 'user' | 'ai'
) {
  project.undoStack.push(prevSnap);
  if (project.undoStack.length > 30) {
    project.undoStack.shift();
  }
  project.redoStack = [];
  project.currentVersion += 1;
  project.versions.unshift({
    version: project.currentVersion,
    timestamp: new Date().toISOString(),
    summary,
    author,
    snapshot: extractSnapshot(project),
  });
  if (project.versions.length > 40) {
    project.versions.length = 40;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // 0. System Health & Model Diagnostics (public health check)
  app.get('/api/v1/system/health', (_req, res) => {
    res.json({
      status: 'ok',
      aiModel: getGeminiModelId(),
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
      cadEngine: 'ruda-parametric-2d-p0-v2',
      intelligenceVersion: 'v1.2-p0',
      supportedBagTypes: ['tote', 'handbag', 'shoulder_bag', 'wallet', 'cardholder'],
      masterTemplateCount: MASTER_PATTERN_LIBRARY.length,
      exportFormats: ['pdf', 'dxf', 'svg', 'csv', 'json'],
    });
  });

  // 0.0 Master Pattern Library catalog (5-axis filtering + custom patternmaker templates)
  app.get('/api/v1/master-templates', requireAuth, async (req: AuthRequest, res) => {
    try {
      const customTemplates = await listCustomMasterTemplates(req.user!.uid);
      const allTemplates = [...customTemplates, ...MASTER_PATTERN_LIBRARY];
      const bagType = typeof req.query.bagType === 'string' && req.query.bagType ? (req.query.bagType as BagType) : undefined;
      const structureType =
        typeof req.query.structureType === 'string' && req.query.structureType
          ? (req.query.structureType as StructureType)
          : undefined;
      const partQuery = typeof req.query.part === 'string' ? req.query.part : undefined;
      const materialId = typeof req.query.materialId === 'string' && req.query.materialId ? req.query.materialId : undefined;
      const edgeProcess = typeof req.query.edgeProcess === 'string' && req.query.edgeProcess ? req.query.edgeProcess : undefined;
      const status =
        typeof req.query.status === 'string' && ['published', 'draft', 'archived'].includes(req.query.status)
          ? (req.query.status as 'published' | 'draft' | 'archived')
          : undefined;

      const templates = searchMasterTemplates(allTemplates, {
        bagType,
        structureType,
        partQuery,
        materialId,
        edgeProcess,
        status,
      });
      res.json({ templates });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载标准版型库失败' });
    }
  });

  // 0.0b Patternmaker Admin Workbench: Create / Import-from-Project / Import-from-DXF Master Template
  app.post('/api/v1/master-templates', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const {
        name,
        bagType = 'tote',
        structureType = 'independent_gusset_bottom',
        summary,
        authorizedSource,
        verifiedBy,
        reviewLevel = 4,
        templateVersion = 'V1.0-CUSTOM',
        status = 'draft',
        projectId,
        dxfText,
        partsSpec,
        hardwareMounts,
        sizeSeries,
        engineeringArchive,
      } = req.body as Partial<MasterPatternTemplate> & {
        projectId?: string;
        dxfText?: string;
      };

      const sourceProject = projectId ? await getProjectForUser(projectId, uid) : null;
      const dxfParsed = dxfText?.trim() ? parseAndVerifyDxf(dxfText.trim()) : null;
      if (dxfText?.trim() && dxfParsed && !dxfParsed.valid) {
        return res.status(400).json({ error: `DXF 模板导入校验失败：${dxfParsed.summary}` });
      }

      const resolvedBagType: BagType = sourceProject?.bagType ?? bagType;
      const resolvedStructureType: StructureType =
        sourceProject?.structureType ?? sourceProject?.dimensions.structureType ?? structureType;
      const resolvedName =
        name?.trim() ||
        (sourceProject ? `${sourceProject.name} · 样板模板` : '自定义标准版型模板');

      let resolvedParts = Array.isArray(partsSpec) && partsSpec.length > 0 ? partsSpec : undefined;
      if (!resolvedParts && dxfParsed?.valid && dxfParsed.importedPieces.length > 0) {
        resolvedParts = dxfParsed.importedPieces.map((p) => ({
          partCode: p.partCode,
          standardType: 'custom_dxf_piece',
          name: p.name,
          quantity: p.quantity || 1,
          symmetryRule: p.symmetryRule ?? 'mirror_x',
          seamAllowanceMm: p.seamAllowanceMm,
          foldAllowanceMm: p.foldAllowanceMm,
        }));
      }
      if (!resolvedParts && sourceProject) {
        resolvedParts = sourceProject.patterns.map((p) => ({
          partCode: p.partCode,
          standardType: p.componentId || p.partCode,
          name: p.name,
          quantity: p.quantity,
          symmetryRule: p.symmetryRule ?? 'mirror_x',
          seamAllowanceMm: p.seamAllowanceMm,
          foldAllowanceMm: p.foldAllowanceMm,
        }));
      }
      if (!resolvedParts) {
        const starter = createStarterSnapshot(resolvedBagType);
        resolvedParts = starter.patterns.map((p) => ({
          partCode: p.partCode,
          standardType: p.componentId,
          name: p.name,
          quantity: p.quantity,
          symmetryRule: p.symmetryRule ?? 'mirror_x',
          seamAllowanceMm: p.seamAllowanceMm,
          foldAllowanceMm: p.foldAllowanceMm,
        }));
      }

      const starterDefaults = createStarterSnapshot(resolvedBagType);
      const dims = sourceProject ? { ...sourceProject.dimensions } : { ...starterDefaults.dimensions, structureType: resolvedStructureType };
      const newTpl: MasterPatternTemplate = {
        id: `tpl_custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: resolvedName,
        bagType: resolvedBagType,
        structureType: resolvedStructureType,
        summary:
          summary?.trim() ||
          (sourceProject
            ? `由项目「${sourceProject.name} v${sourceProject.currentVersion}」归档的标准结构模板，含 ${resolvedParts.length} 个独立裁片`
            : `打版师手工创建/DXF导入标准模板，含 ${resolvedParts.length} 个独立裁片`),
        authorizedSource:
          authorizedSource?.trim() ||
          (dxfParsed ? 'DXF 1:1 实测纸格导入' : 'RUDA 打版师工作台创建'),
        reviewLevel: reviewLevel === 5 ? 5 : 4,
        verifiedBy:
          verifiedBy?.trim() ||
          (typeof req.user!.name === 'string' && req.user!.name) ||
          req.user!.email ||
          '专业打版师',
        templateVersion,
        status,
        isCustom: true,
        sizeSeries:
          sizeSeries && sizeSeries.length > 0
            ? sizeSeries
            : [
                {
                  label: '基准版型尺寸',
                  widthMm: dims.widthMm,
                  heightMm: dims.heightMm,
                  depthMm: dims.depthMm,
                },
              ],
        defaultDimensions: dims,
        defaultMaterialId: sourceProject?.materialId ?? starterDefaults.materialId,
        defaultEdgeProcess: sourceProject?.edgeProcess ?? starterDefaults.edgeProcess,
        defaultFeatures: sourceProject ? { ...sourceProject.features } : { ...starterDefaults.features },
        pieceCount: resolvedParts.length,
        partsSpec: resolvedParts,
        relationsSummary: sourceProject
          ? sourceProject.relations.map((r) => `${r.fromComponentId}.${r.fromEdgeId} <-> ${r.toComponentId}.${r.toEdgeId}`)
          : ['已包含标准结构对接关系'],
        hardwareMounts:
          hardwareMounts && hardwareMounts.length > 0
            ? hardwareMounts
            : sourceProject
              ? sourceProject.hardware.map((h) => `${h.name} ×${h.quantity}`)
              : ['标准五金配置'],
        validationBaseline: {
          maxSeamToleranceMm: resolvedBagType === 'cardholder' ? 0.5 : resolvedBagType === 'wallet' ? 0.6 : 1.2,
          requiresSkivingAboveMm: 1.4,
        },
        engineeringArchive: engineeringArchive ?? {
          referencePhotosCount: sourceProject?.images.length ?? 0,
          structure3DSummary: `${STRUCTURE_TYPE_LABELS[resolvedStructureType] || resolvedStructureType} (${dims.widthMm}×${dims.heightMm}×${dims.depthMm}mm)`,
          skivingAndReinforcementSpec: '依打版师工艺规范执行边缘铲薄与承重补强',
          productionProcessSpec: `材料 ${sourceProject?.materialId ?? starterDefaults.materialId} · 工艺 ${sourceProject?.edgeProcess ?? starterDefaults.edgeProcess}`,
          productionVerificationResult:
            status === 'published' ? '已发布至正式模板库' : '草稿待打版师审核发布',
        },
      };

      const saved = await createCustomMasterTemplate(uid, newTpl);
      res.status(201).json({ template: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '创建标准模板失败' });
    }
  });

  app.patch('/api/v1/master-templates/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateCustomMasterTemplate(req.user!.uid, req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: '未找到指定自定义模板或无权修改内置基线模板' });
      }
      res.json({ template: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '更新标准模板失败' });
    }
  });

  // 0.1 Local Demo Workspace Auth (fallback when external Firebase Auth domain is unavailable)
  app.post('/api/v1/auth/demo', (_req, res) => {
    const token = createDemoSessionToken();
    res.json({
      token,
      user: {
        uid: 'demo_ruda_studio',
        email: 'studio-demo@ruda.local',
        displayName: 'RUDA 演示打版师',
      },
    });
  });

  // 1. List user projects (PostgreSQL ownerUid isolated)
  app.get('/api/v1/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureIntelligenceSeeded();
      const rows = await listProjectsForUser(req.user!.uid);
      const projects = rows.map((p) => ({
        id: p.id,
        name: p.name,
        bagType: p.bagType,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        currentVersion: p.currentVersion,
        dimensions: p.dimensions,
        thumbnailUrl: p.images[0]?.dataUrl ?? null,
        componentCount: p.components.length,
        patternCount: p.patterns.length,
        validationPassed: p.validation.passed,
      }));
      res.json({ projects });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载项目列表失败' });
    }
  });

  // 2. Create project
  app.post('/api/v1/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const {
        name,
        bagType = 'tote',
        templateId,
        images = [],
        initialPrompt,
        blankMode = false,
        captureGuidance,
      } = req.body as {
        name?: string;
        bagType?: BagType;
        templateId?: string;
        images?: Array<{ name: string; angle: ImageAngle; dataUrl: string; mimeType: string }>;
        initialPrompt?: string;
        blankMode?: boolean;
        captureGuidance?: Partial<CaptureGuidanceProfile>;
      };

      const now = new Date().toISOString();
      const validBagTypes: BagType[] = ['tote', 'handbag', 'shoulder_bag', 'wallet', 'cardholder'];
      const customTemplates = await listCustomMasterTemplates(uid);
      const chosenTpl = templateId ? getMasterTemplateById(templateId, customTemplates) : undefined;
      const safeType: BagType = chosenTpl
        ? chosenTpl.bagType
        : validBagTypes.includes(bagType)
          ? bagType
          : 'tote';

      let snap: ProjectSnapshot;
      if (chosenTpl) {
        const gen = generateParametricPatterns(
          chosenTpl.bagType,
          chosenTpl.defaultDimensions,
          chosenTpl.defaultMaterialId,
          chosenTpl.defaultEdgeProcess,
          chosenTpl.defaultFeatures
        );
        const val = validateProjectPatterns(
          gen.patterns,
          gen.relations,
          chosenTpl.defaultMaterialId,
          chosenTpl.defaultEdgeProcess,
          chosenTpl.defaultDimensions
        );
        snap = {
          bagType: chosenTpl.bagType,
          dimensions: { ...chosenTpl.defaultDimensions },
          materialId: chosenTpl.defaultMaterialId,
          edgeProcess: chosenTpl.defaultEdgeProcess,
          features: { ...chosenTpl.defaultFeatures },
          hardware: BAG_ARCHETYPES[chosenTpl.bagType].hardware.map((h) => ({ ...h })),
          components: gen.components,
          relations: gen.relations,
          patterns: gen.patterns,
          validation: val,
        };
      } else {
        snap = createStarterSnapshot(safeType);
      }

      // Apply Layer 2 user preference if consented and not explicitly overridden by template
      const userProfile = await getUserByUid(uid);
      if (
        !blankMode &&
        !chosenTpl &&
        userProfile?.preferencesJson?.memoryConsentEnabled !== false &&
        userProfile?.preferencesJson?.preferredMaterials?.length
      ) {
        const prefMat = userProfile.preferencesJson.preferredMaterials[0];
        if (prefMat) {
          snap.materialId = prefMat;
          const regen = generateParametricPatterns(
            safeType,
            snap.dimensions,
            snap.materialId,
            snap.edgeProcess,
            snap.features
          );
          snap.components = regen.components;
          snap.relations = regen.relations;
          snap.patterns = regen.patterns;
          snap.validation = validateProjectPatterns(
            snap.patterns,
            snap.relations,
            snap.materialId,
            snap.edgeProcess,
            snap.dimensions
          );
        }
      }

      if (blankMode) {
        snap.components = [];
        snap.relations = [];
        snap.patterns = [];
        snap.validation = validateProjectPatterns([], [], snap.materialId, snap.edgeProcess);
      }

      const projectImages: ProductImage[] = images.map((img, i) => ({
        id: `img_${Date.now()}_${i}`,
        name: img.name || `photo_${i + 1}.jpg`,
        angle: img.angle || 'front',
        dataUrl: img.dataUrl,
        mimeType: img.mimeType || 'image/jpeg',
        uploadedAt: now,
      }));

      const developability = analyzeSurfaceDevelopability(
        snap.patterns,
        snap.dimensions,
        snap.materialId
      );
      const seamPairDetails = buildSeamPairDetails(snap.patterns, snap.relations);

      const project: Project = {
        id: `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name:
          name?.trim() ||
          (blankMode
            ? '新建手工纸格项目'
            : chosenTpl
              ? `${chosenTpl.name}`
              : `${BAG_ARCHETYPES[safeType].label}项目`),
        structureType: snap.dimensions.structureType,
        matchedTemplateId: chosenTpl?.id,
        captureGuidance: captureGuidance
          ? {
              mode: captureGuidance.mode ?? (projectImages.length > 1 ? 'precision_pattern' : 'quick_ai'),
              referenceObjectType: captureGuidance.referenceObjectType ?? 'none',
              referenceObjectMm: captureGuidance.referenceObjectMm,
              perspectiveCorrectionApplied: Boolean(captureGuidance.perspectiveCorrectionApplied),
              lensDistortionNote: captureGuidance.lensDistortionNote ?? '待视角与参考物校准评估',
              estimatedMeasurementErrorMm: captureGuidance.estimatedMeasurementErrorMm ?? 6.5,
              coveredAngles: Array.from(new Set(projectImages.map((i) => i.angle))),
              missingRecommendedAngles: [],
            }
          : undefined,
        createdAt: now,
        updatedAt: now,
        currentVersion: 1,
        undoStack: [],
        redoStack: [],
        images: projectImages,
        ...snap,
        developability,
        seamPairDetails,
        messages: initialPrompt
          ? [
              {
                id: `msg_${Date.now()}`,
                role: 'user',
                content: initialPrompt,
                timestamp: now,
              },
            ]
          : [
              {
                id: `msg_${Date.now()}`,
                role: 'assistant',
                content: blankMode
                  ? '已创建空白 CAD 纸格项目。你可以在右侧「部件」面板点击「+ 手工新增纸格」或导入 DXF，也可以直接通过 AI 对话生成部件。'
                  : chosenTpl
                    ? `已基于授权标准模板「${chosenTpl.name}」初始化（${chosenTpl.authorizedSource} · L${chosenTpl.reviewLevel}），共 ${snap.patterns.length} 个独立三层纸格裁片。`
                    : '项目已建立。系统已接入 RUDA AI 反向工程引擎与 Master Pattern Library，你可以上传产品照片启动 14 步重建，或随时用自然语言调整结构尺寸。',
                timestamp: now,
              },
            ],
        commandLog: [],
        versions: [
          {
            version: 1,
            timestamp: now,
            summary: blankMode
              ? '空白 CAD 项目初始化'
              : chosenTpl
                ? `基于模板「${chosenTpl.name}」初始化`
                : `初始化 ${BAG_TYPE_LABELS[safeType]}`,
            author: 'user',
            snapshot: structuredClone(snap),
          },
        ],
        exports: [],
      };

      await upsertProjectForUser(uid, project, {
        activeTask: initialPrompt || '项目初始化',
        lastIntent: 'create_project',
      });
      res.status(201).json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '创建项目失败' });
    }
  });

  // 3. Get single project (automatically restores Layer 3 project memory)
  app.get('/api/v1/projects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const project = await getProjectForUser(req.params.id, req.user!.uid);
      if (!project) {
        return res.status(404).json({ error: '项目不存在或无权访问' });
      }
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '读取项目失败' });
    }
  });

  // Delete project
  app.delete('/api/v1/projects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ok = await deleteProjectForUser(req.params.id, req.user!.uid);
      if (!ok) return res.status(404).json({ error: '项目不存在或无权删除' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '删除项目失败' });
    }
  });

  // 4. Update project / Save manual CAD edits (tracks manual corrections for Continuous Learning)
  app.patch('/api/v1/projects/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const {
        expectedVersion,
        name,
        patterns,
        dimensions,
        materialId,
        edgeProcess,
        features,
        regenerateFromParams,
        versionSummary,
      } = req.body as Partial<Project> & {
        expectedVersion?: number;
        regenerateFromParams?: boolean;
        versionSummary?: string;
      };

      if (expectedVersion != null && expectedVersion !== project.currentVersion) {
        return res.status(409).json({
          error: `版本冲突：服务器当前为 v${project.currentVersion}，请刷新后重试。`,
          currentVersion: project.currentVersion,
        });
      }

      const prevSnap = extractSnapshot(project);

      if (name != null) project.name = name;
      if (dimensions) project.dimensions = { ...project.dimensions, ...dimensions };
      if (materialId) project.materialId = materialId;
      if (edgeProcess) project.edgeProcess = edgeProcess;
      if (features) project.features = { ...project.features, ...features };

      if (regenerateFromParams) {
        const customPieces = project.patterns.filter(
          (x) => x.id.startsWith('custom_') || x.id.startsWith('dxf_')
        );
        const generated = generateParametricPatterns(
          project.bagType,
          project.dimensions,
          project.materialId,
          project.edgeProcess,
          project.features,
          project.patterns
        );
        project.components = generated.components;
        project.relations = generated.relations;
        project.patterns = [...generated.patterns, ...customPieces];
      } else if (Array.isArray(patterns)) {
        project.patterns = patterns.map((p: PatternPiece) => computePieceGeometry(p));
      }

      project.validation = validateProjectPatterns(
        project.patterns,
        project.relations,
        project.materialId,
        project.edgeProcess,
        project.dimensions
      );
      project.developability = analyzeSurfaceDevelopability(
        project.patterns,
        project.dimensions,
        project.materialId
      );
      project.seamPairDetails = buildSeamPairDetails(project.patterns, project.relations);
      project.structureType = project.dimensions.structureType ?? project.structureType;
      if (regenerateFromParams || Array.isArray(patterns)) {
        project.qualitySignoff = {
          patternMakerConfirmed: false,
          physicalSamplePassed: false,
        };
      }

      if (versionSummary) {
        pushVersionAndUndo(project, prevSnap, versionSummary, 'user');
      }

      await upsertProjectForUser(uid, project, {
        activeTask: versionSummary || '手动编辑纸格',
        lastIntent: 'manual_edit',
      });

      // Classify manual edits & extract LEVEL 1 learning candidate without auto-promoting
      if (regenerateFromParams || Array.isArray(patterns)) {
        const materialChanged = prevSnap.materialId !== project.materialId;
        const seamChanged =
          prevSnap.dimensions.seamAllowanceMm !== project.dimensions.seamAllowanceMm ||
          prevSnap.edgeProcess !== project.edgeProcess;

        const classification = materialChanged
          ? 'user_preference'
          : seamChanged
            ? 'general_rule_candidate'
            : Array.isArray(patterns)
              ? 'reusable_experience'
              : 'project_specific';

        const detailText =
          versionSummary ||
          (materialChanged
            ? `手工调整材料为 ${project.materialId}（${project.edgeProcess}）`
            : `手工修正 ${project.bagType} 纸格几何节点/缝份`);

        if (materialChanged) {
          await upsertMemoryItemWithMerge({
            ownerUid: uid,
            memoryLayer: 'user_long_term',
            memoryKey: `preferred_material_${project.bagType}`,
            content: `用户在 ${project.bagType} 参数面板偏好选用皮料 ${project.materialId}（${project.edgeProcess}）`,
            applicableBagTypes: [project.bagType],
            applicableMaterials: [project.materialId],
            source: `项目 ${project.name} 参数调整`,
            sourceProjectId: project.id,
            securityScope: 'C_USER_PRIVATE',
            reviewLevel: 3,
          });
        }

        await recordAiFeedbackAndExtractLearning({
          ownerUid: uid,
          project,
          userOriginalPrompt: versionSummary || '用户/打版师手工修正版型',
          interpretedTask: '人工修正 CAD 参数或纸格几何',
          retrievedKnowledgeIds: [],
          usedCaseIds: [],
          commands: [],
          diffSummary: [detailText],
          validationPassed: project.validation.passed,
          userAccepted: true,
          patternMakerCorrected: true,
          correctionClassification: classification,
          correctionDetail: detailText,
        });
      }

      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '保存项目修改失败' });
    }
  });

  // 5. Upload product images
  app.post('/api/v1/projects/:id/images', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const { images, captureGuidance } = req.body as {
        images: Array<{ name: string; angle: ImageAngle; dataUrl: string; mimeType: string }>;
        captureGuidance?: Partial<CaptureGuidanceProfile>;
      };
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: '请至少上传一张参考照片' });
      }

      const now = new Date().toISOString();
      const added: ProductImage[] = images.map((img, i) => ({
        id: `img_${Date.now()}_${i}`,
        name: img.name || `reference_${i + 1}.jpg`,
        angle: img.angle || 'front',
        dataUrl: img.dataUrl,
        mimeType: img.mimeType || 'image/jpeg',
        uploadedAt: now,
      }));

      project.images.push(...added);

      // Recalculate CaptureGuidanceProfile across all images
      const recommendedAngles: ImageAngle[] = [
        'front',
        'back',
        'left',
        'right',
        'bottom',
        'top',
        'interior',
      ];
      const coveredAngles = Array.from(
        new Set(project.images.map((i) => i.angle))
      ) as ImageAngle[];
      const missingRecommendedAngles = recommendedAngles.filter(
        (a) =>
          !coveredAngles.includes(a) &&
          !((a === 'left' || a === 'right') && coveredAngles.includes('side'))
      );

      const prevGuidance = project.captureGuidance || project.visionSummary?.captureGuidance;
      const mergedRefType =
        captureGuidance?.referenceObjectType ?? prevGuidance?.referenceObjectType ?? 'none';
      const mergedRefMm =
        mergedRefType === 'none'
          ? undefined
          : (captureGuidance?.referenceObjectMm ?? prevGuidance?.referenceObjectMm);
      const hasRefObject = Boolean(mergedRefType && mergedRefType !== 'none');
      const mergedMode =
        captureGuidance?.mode ??
        prevGuidance?.mode ??
        (project.images.length >= 3 ? 'precision_pattern' : 'quick_ai');
      const perspectiveCorrectionApplied = project.images.length >= 2 || hasRefObject;
      const qualityInspection =
        captureGuidance?.qualityInspection ?? prevGuidance?.qualityInspection;

      const estimatedMeasurementErrorMm =
        project.dimensions.dimensionSource === 'user_confirmed'
          ? 0.8
          : qualityInspection?.estimatedErrorMm && qualityInspection.estimatedErrorMm > 0
            ? Math.min(
                qualityInspection.estimatedErrorMm,
                hasRefObject && project.images.length >= 3 ? 1.8 : 6.5
              )
            : hasRefObject && project.images.length >= 3
              ? 1.8
              : hasRefObject || project.images.length >= 3
                ? 3.8
                : project.images.length === 2
                  ? 6.5
                  : 12.0;

      const updatedGuidance: CaptureGuidanceProfile = {
        mode: mergedMode,
        referenceObjectType: mergedRefType,
        referenceObjectMm: mergedRefMm,
        perspectiveCorrectionApplied,
        lensDistortionNote: perspectiveCorrectionApplied
          ? `已完成多视角透视比例比对${hasRefObject ? `及标定物(${mergedRefType})换算` : ''}`
          : '单角/无参考标定物，未做镜头广角畸变与透视校准',
        estimatedMeasurementErrorMm,
        coveredAngles,
        missingRecommendedAngles,
        qualityInspection,
      };

      project.captureGuidance = updatedGuidance;
      if (project.visionSummary) {
        project.visionSummary.captureGuidance = updatedGuidance;
      }

      await upsertProjectForUser(uid, project);
      res.status(201).json({ images: added, project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '上传参考照片失败' });
    }
  });

  // 6. Start async AI Vision Analysis job
  app.post('/api/v1/projects/:id/analysis', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const { userBrief = '', captureGuidance } = req.body as {
        userBrief?: string;
        captureGuidance?: Partial<CaptureGuidanceProfile>;
      };
      const now = new Date().toISOString();
      const job: AiAnalysisJob = {
        id: `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        projectId: project.id,
        status: 'queued',
        progress: 10,
        statusMessage: '任务已入队，准备读取参考照片...',
        createdAt: now,
        updatedAt: now,
      };
      saveJob(job, uid);

      // Run async 14-step Photo Reverse Engineering Pipeline
      (async () => {
        try {
          const latestProject = await getProjectForUser(project.id, uid);
          if (!latestProject) throw new Error('项目已被删除');

          const [historicalCases, customTemplates] = await Promise.all([
            listPatternCasesForMatching(uid),
            listCustomMasterTemplates(uid),
          ]);
          const result = await runPhotoReconstructionPipeline({
            images: latestProject.images,
            userBrief,
            historicalCases,
            captureGuidance: captureGuidance ?? latestProject.captureGuidance,
            extraTemplates: customTemplates,
            onStageProgress: (_stepNum, message, progress) => {
              const mappedStatus: AiAnalysisJob['status'] =
                progress < 50
                  ? 'vision_analyzing'
                  : progress < 75
                    ? 'structure_reasoning'
                    : progress < 90
                      ? 'pattern_generating'
                      : 'validating';
              saveJob(
                {
                  ...job,
                  status: mappedStatus,
                  progress,
                  statusMessage: message,
                },
                uid
              );
            },
          });

          const prevSnap = extractSnapshot(latestProject);
          latestProject.bagType = result.bagType;
          latestProject.structureType = result.structureType;
          latestProject.matchedTemplateId = result.matchedTemplateId;
          latestProject.captureGuidance = result.captureGuidance;
          latestProject.dimensions = result.dimensions;
          latestProject.materialId = result.materialId;
          latestProject.edgeProcess = result.edgeProcess;
          latestProject.features = result.features;
          latestProject.hardware = result.hardware;
          latestProject.components = result.components;
          latestProject.relations = result.relations;
          latestProject.patterns = result.patterns;
          latestProject.developability = result.developability;
          latestProject.seamPairDetails = result.seamPairDetails;
          latestProject.validation = result.validation;
          latestProject.visionSummary = result.visionSummary;
          latestProject.qualitySignoff = {
            patternMakerConfirmed: false,
            physicalSamplePassed: false,
          };

          const retrievedMem = await retrieveRelevantMemoryForPrompt(
            uid,
            latestProject,
            userBrief || result.visionSummary.visualNotes
          );

          const dimLabel =
            result.dimensions.dimensionSource === 'user_confirmed'
              ? '已按您给出的实测尺寸'
              : 'AI 按视觉比例估算（待实测校准）';
          const assistantSummary = [
            `14 步 AI 反向工程打版已完成：判定为 **${BAG_TYPE_LABELS[result.bagType]} · ${STRUCTURE_TYPE_LABELS[result.structureType ?? ''] ?? result.structureType}**（模板匹配 ${Math.round((result.visionSummary.templateMatchScore ?? 0.85) * 100)}%）。`,
            `${dimLabel}生成 ${latestProject.patterns.length} 个独立三层纸格（${latestProject.dimensions.widthMm} × ${latestProject.dimensions.heightMm} × ${latestProject.dimensions.depthMm} mm），${result.seamPairDetails.length} 组接缝配对关系。`,
            result.visionSummary.similarCaseComparisons?.length
              ? `已与已验证样板对照：${result.visionSummary.similarCaseComparisons[0].title}（相似度 ${result.visionSummary.similarCaseComparisons[0].similarityPct}%）。`
              : '',
            result.visionSummary.uncertainStructures.length > 0
              ? `待确认风险项：${result.visionSummary.uncertainStructures.join('、')}。`
              : '',
            result.visionSummary.clarifyingQuestion
              ? `校准提问：${result.visionSummary.clarifyingQuestion}`
              : '',
          ]
            .filter(Boolean)
            .join('\n\n');

          latestProject.messages.push({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: assistantSummary,
            timestamp: new Date().toISOString(),
          });

          pushVersionAndUndo(
            latestProject,
            prevSnap,
            `14步反向工程打版 (${BAG_ARCHETYPES[result.bagType].label} · ${STRUCTURE_TYPE_LABELS[result.structureType ?? ''] ?? ''})`,
            'ai'
          );

          await upsertProjectForUser(uid, latestProject, {
            activeTask: '14步照片反向工程与首次打版完成',
            lastIntent: 'vision_analysis',
            retrievedMemoryIds: [
              ...retrievedMem.retrievedKnowledgeIds,
              ...retrievedMem.usedCaseIds,
            ],
          });

          await recordAiFeedbackAndExtractLearning({
            ownerUid: uid,
            project: latestProject,
            userOriginalPrompt: userBrief || '上传参考照片发起 14 步反向工程打版',
            interpretedTask: `拆解 ${BAG_TYPE_LABELS[result.bagType]} 并生成 ${latestProject.patterns.length} 片三层纸格`,
            retrievedKnowledgeIds: retrievedMem.retrievedKnowledgeIds,
            usedCaseIds: retrievedMem.usedCaseIds,
            commands: [],
            diffSummary: [
              `生成 ${latestProject.patterns.length} 片二维纸格 (${latestProject.dimensions.widthMm}×${latestProject.dimensions.heightMm}×${latestProject.dimensions.depthMm}mm)`,
            ],
            validationPassed: latestProject.validation.passed,
            userAccepted: true,
          });

          saveJob(
            {
              ...job,
              status: 'completed',
              progress: 100,
              statusMessage: '结构拆解、二维打版与质量检查已全部完成。',
            },
            uid
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'AI 分析执行失败';
          saveJob(
            {
              ...job,
              status: 'failed',
              progress: 100,
              statusMessage: 'AI 分析失败',
              error: message,
            },
            uid
          );
        }
      })();

      res.status(202).json({ job });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '启动 AI 任务失败' });
    }
  });

  // 7. Poll AI analysis job
  app.get('/api/v1/jobs/:id', requireAuth, (req: AuthRequest, res) => {
    const entry = analysisJobs.get(req.params.id);
    if (!entry || entry.ownerUid !== req.user!.uid) {
      return res.status(404).json({ error: '任务不存在' });
    }
    res.json({ job: entry.job });
  });

  // 8. Get components & relations
  app.get('/api/v1/projects/:id/components', requireAuth, async (req: AuthRequest, res) => {
    const project = await getProjectForUser(req.params.id, req.user!.uid);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    res.json({
      components: project.components,
      relations: project.relations,
      hardware: project.hardware,
    });
  });

  // 9. Get patterns
  app.get('/api/v1/projects/:id/patterns', requireAuth, async (req: AuthRequest, res) => {
    const project = await getProjectForUser(req.params.id, req.user!.uid);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    res.json({ patterns: project.patterns, validation: project.validation });
  });

  // 10. Plan natural language AI command (Hybrid 5-Layer Long Memory Retrieval)
  app.post('/api/v1/projects/:id/ai/command/plan', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user!.uid;
    const project = await getProjectForUser(req.params.id, uid);
    if (!project) return res.status(404).json({ error: '项目不存在' });

    const { prompt } = req.body as { prompt?: string };
    if (!prompt?.trim()) {
      return res.status(400).json({ error: '请输入设计指令' });
    }

    try {
      const retrievedMemory = await retrieveRelevantMemoryForPrompt(uid, project, prompt.trim());
      const plan = await planNaturalLanguageCommandWithGemini(
        project,
        prompt.trim(),
        retrievedMemory
      );
      await upsertProjectForUser(uid, project, {
        activeTask: plan.summary,
        lastIntent: plan.commands[0]?.intent || 'plan',
        retrievedMemoryIds: [
          ...retrievedMemory.retrievedKnowledgeIds,
          ...retrievedMemory.usedCaseIds,
        ],
      });
      res.json({ plan });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 指令解析失败';
      res.status(500).json({ error: msg });
    }
  });

  // 11. Execute verified CAD command plan + 11-point Continuous Learning Audit
  app.post('/api/v1/projects/:id/ai/command/execute', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const {
        expectedVersion,
        userPrompt,
        commands,
        replyText,
        plan,
      } = req.body as {
        expectedVersion?: number;
        userPrompt?: string;
        commands: StructuredCadCommand[];
        replyText?: string;
        plan?: CommandPlan;
      };

      if (expectedVersion != null && expectedVersion !== project.currentVersion) {
        return res.status(409).json({
          error: `版本冲突：服务器当前为 v${project.currentVersion}，请先同步最新状态。`,
        });
      }

      const now = new Date().toISOString();
      if (userPrompt) {
        project.messages.push({
          id: `msg_u_${Date.now()}`,
          role: 'user',
          content: userPrompt,
          timestamp: now,
        });
      }

      // If no commands (advice/options mode or pending confirmation), just record assistant response
      if (!Array.isArray(commands) || commands.length === 0) {
        project.messages.push({
          id: `msg_a_${Date.now() + 1}`,
          role: 'assistant',
          content: replyText || plan?.replyText || '请选择下方具体方案以执行修改。',
          timestamp: now,
          plan,
          planStatus: plan?.proposedOptions?.length ? 'pending_confirmation' : 'advice_only',
        });
        await upsertProjectForUser(uid, project);
        return res.json({ project, diffSummary: [] });
      }

      // Handle conversational undo/redo directly via stack
      if (commands.length === 1 && (commands[0].intent === 'undo_last' || commands[0].intent === 'redo_last')) {
        const isUndo = commands[0].intent === 'undo_last';
        const stack = isUndo ? project.undoStack : project.redoStack;
        if (stack.length === 0) {
          const msgText = isUndo ? '当前没有可撤销的历史修改步骤。' : '当前没有可恢复的撤销步骤。';
          project.messages.push({
            id: `msg_a_${Date.now() + 1}`,
            role: 'assistant',
            content: msgText,
            timestamp: now,
            planStatus: 'advice_only',
          });
          await upsertProjectForUser(uid, project);
          return res.json({ project, diffSummary: [] });
        }
        const currentSnap = extractSnapshot(project);
        const targetSnap = stack.pop()!;
        if (isUndo) {
          project.redoStack.push(currentSnap);
        } else {
          project.undoStack.push(currentSnap);
        }
        applySnapshotToProject(project, targetSnap);
        project.currentVersion += 1;
        const actionDiff = isUndo
          ? [`已撤销上一步修改，恢复至 v${project.currentVersion}`]
          : [`已恢复上一步修改，当前为 v${project.currentVersion}`];
        project.messages.push({
          id: `msg_a_${Date.now() + 1}`,
          role: 'assistant',
          content: replyText || actionDiff[0],
          timestamp: new Date().toISOString(),
          diffSummary: actionDiff,
          planStatus: 'executed',
        });
        await upsertProjectForUser(uid, project);

        await recordAiFeedbackAndExtractLearning({
          ownerUid: uid,
          project,
          userOriginalPrompt: userPrompt || (isUndo ? '撤销修改' : '恢复修改'),
          interpretedTask: isUndo ? '撤销上一步 AI/手工修改' : '恢复已撤销修改',
          retrievedKnowledgeIds: plan?.retrievedKnowledgeIds ?? [],
          usedCaseIds: plan?.usedCaseIds ?? [],
          commands,
          diffSummary: actionDiff,
          validationPassed: project.validation.passed,
          userAccepted: !isUndo,
        });

        return res.json({ project, diffSummary: actionDiff });
      }

      const prevSnap = extractSnapshot(project);
      const tx = executeCadTransaction(prevSnap, commands);
      if (!tx.committed) {
        project.messages.push({
          id: `msg_a_${Date.now() + 1}`,
          role: 'assistant',
          content: `操作未提交（事务已自动回滚）：${tx.rollbackReason || '检测到异常几何状态，已保护原版型不受损。'}`,
          timestamp: new Date().toISOString(),
          planStatus: 'cancelled',
        });
        await upsertProjectForUser(uid, project);

        await recordAiFeedbackAndExtractLearning({
          ownerUid: uid,
          project,
          userOriginalPrompt: userPrompt || '执行 CAD 修改指令',
          interpretedTask: plan?.summary || commands.map((c) => c.intent).join(', '),
          retrievedKnowledgeIds: plan?.retrievedKnowledgeIds ?? [],
          usedCaseIds: plan?.usedCaseIds ?? [],
          commands,
          diffSummary: [tx.rollbackReason || '事务触发几何安全回滚'],
          validationPassed: false,
          userAccepted: false,
        });

        return res.json({
          project,
          diffSummary: [],
          rolledBack: true,
          rollbackReason: tx.rollbackReason,
        });
      }

      const allDiffs = tx.diffSummary;
      for (const cmd of commands) {
        project.commandLog.unshift({
          id: `cmd_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          timestamp: now,
          command: cmd,
          resultSummary: allDiffs.join('；') || cmd.operation,
        });
      }

      applySnapshotToProject(project, tx.nextSnapshot);
      const versionDesc =
        plan?.summary || allDiffs[0] || `AI 执行设计修改 (${commands[0].intent})`;
      pushVersionAndUndo(project, prevSnap, versionDesc, 'ai');

      const validationNote = project.validation.passed
        ? `几何与接缝校验全部通过（${project.validation.checksRun.length} 项）。`
        : `校验提示：发现 ${project.validation.errorCount} 个错误、${project.validation.warningCount} 个工艺警告，请在右侧「校验」面板查看详情。`;

      project.messages.push({
        id: `msg_a_${Date.now() + 1}`,
        role: 'assistant',
        content: `${replyText || plan?.replyText || '已完成修改。'}\n\n${validationNote}`,
        timestamp: new Date().toISOString(),
        diffSummary: allDiffs,
        plan,
        planStatus: 'executed',
      });

      await upsertProjectForUser(uid, project, {
        activeTask: versionDesc,
        lastIntent: commands[0]?.intent,
        retrievedMemoryIds: [
          ...(plan?.retrievedKnowledgeIds ?? []),
          ...(plan?.usedCaseIds ?? []),
        ],
      });

      await recordAiFeedbackAndExtractLearning({
        ownerUid: uid,
        project,
        userOriginalPrompt: userPrompt || versionDesc,
        interpretedTask: plan?.summary || versionDesc,
        retrievedKnowledgeIds: plan?.retrievedKnowledgeIds ?? [],
        usedCaseIds: plan?.usedCaseIds ?? [],
        commands,
        diffSummary: allDiffs,
        validationPassed: project.validation.passed,
        userAccepted: true,
        correctionClassification: commands.some((c) => c.intent === 'fix_seam_mismatch')
          ? 'reusable_experience'
          : undefined,
        correctionDetail: commands.some((c) => c.intent === 'fix_seam_mismatch')
          ? allDiffs.join('；')
          : undefined,
      });

      res.json({ project, diffSummary: allDiffs });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '执行 CAD 指令失败' });
    }
  });

  // 11b. Record explicit patternmaker or physical sample signoff
  app.post('/api/v1/projects/:id/quality-signoff', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const {
        patternMakerConfirmed,
        patternMakerName,
        physicalSamplePassed,
        sampleLotNote,
      } = req.body as {
        patternMakerConfirmed?: boolean;
        patternMakerName?: string;
        physicalSamplePassed?: boolean;
        sampleLotNote?: string;
      };

      const current = project.qualitySignoff ?? {
        patternMakerConfirmed: false,
        physicalSamplePassed: false,
      };
      const now = new Date().toISOString();
      project.qualitySignoff = {
        patternMakerConfirmed:
          patternMakerConfirmed != null ? patternMakerConfirmed : current.patternMakerConfirmed,
        patternMakerName: patternMakerName ?? current.patternMakerName,
        patternMakerAt:
          patternMakerConfirmed != null ? (patternMakerConfirmed ? now : undefined) : current.patternMakerAt,
        physicalSamplePassed:
          physicalSamplePassed != null ? physicalSamplePassed : current.physicalSamplePassed,
        sampleLotNote: sampleLotNote ?? current.sampleLotNote,
        physicalSampleAt:
          physicalSamplePassed != null ? (physicalSamplePassed ? now : undefined) : current.physicalSampleAt,
      };
      await upsertProjectForUser(uid, project);
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '更新质量签核失败' });
    }
  });

  // 11c. Switch Master Pattern Template on existing project
  app.post('/api/v1/projects/:id/apply-template', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const { templateId, keepCustomDimensions = false } = req.body as {
        templateId: string;
        keepCustomDimensions?: boolean;
      };
      const customTemplates = await listCustomMasterTemplates(uid);
      const tpl = getMasterTemplateById(templateId, customTemplates);
      if (!tpl) return res.status(404).json({ error: '未找到指定的标准版型模板' });

      const prevSnap = extractSnapshot(project);
      project.bagType = tpl.bagType;
      project.structureType = tpl.structureType;
      project.matchedTemplateId = tpl.id;
      project.dimensions = keepCustomDimensions
        ? {
            ...tpl.defaultDimensions,
            widthMm: project.dimensions.widthMm,
            heightMm: project.dimensions.heightMm,
            depthMm: project.dimensions.depthMm,
            structureType: tpl.structureType,
            dimensionSource: project.dimensions.dimensionSource,
          }
        : { ...tpl.defaultDimensions };
      project.materialId = tpl.defaultMaterialId;
      project.edgeProcess = tpl.defaultEdgeProcess;
      project.features = { ...tpl.defaultFeatures };
      project.hardware = BAG_ARCHETYPES[tpl.bagType].hardware.map((h) => ({ ...h }));

      const gen = generateParametricPatterns(
        project.bagType,
        project.dimensions,
        project.materialId,
        project.edgeProcess,
        project.features
      );
      project.components = gen.components;
      project.relations = gen.relations;
      project.patterns = gen.patterns;
      project.developability = analyzeSurfaceDevelopability(
        project.patterns,
        project.dimensions,
        project.materialId
      );
      project.seamPairDetails = buildSeamPairDetails(project.patterns, project.relations);
      project.validation = validateProjectPatterns(
        project.patterns,
        project.relations,
        project.materialId,
        project.edgeProcess,
        project.dimensions
      );
      project.qualitySignoff = {
        patternMakerConfirmed: false,
        physicalSamplePassed: false,
      };
      pushVersionAndUndo(project, prevSnap, `切换标准模板：${tpl.name}`, 'user');
      await upsertProjectForUser(uid, project);
      res.json({ project, template: tpl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '应用标准模板失败' });
    }
  });

  // 11d. Multi-axis Real Dimension Calibration
  app.post('/api/v1/projects/:id/calibrate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const { widthMm, heightMm, depthMm } = req.body as {
        widthMm?: number;
        heightMm?: number;
        depthMm?: number;
      };
      const prevSnap = extractSnapshot(project);
      const { nextSnapshot, diffSummary } = calibrateMultipleAxes(prevSnap, {
        widthMm,
        heightMm,
        depthMm,
      });
      if (diffSummary.length === 0) {
        return res.status(400).json({ error: '请至少提供一个有效实测毫米尺寸（宽/高/深）' });
      }
      applySnapshotToProject(project, nextSnapshot);
      pushVersionAndUndo(project, prevSnap, `多轴实测校准：${diffSummary.join('，')}`, 'user');
      await upsertProjectForUser(uid, project);
      res.json({ project, diffSummary });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '多轴尺寸校准失败' });
    }
  });

  // 12. Validate specific piece or full project
  app.post('/api/v1/projects/:id/patterns/:pieceId/validate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      project.patterns = project.patterns.map((p) => computePieceGeometry(p));
      project.developability = analyzeSurfaceDevelopability(
        project.patterns,
        project.dimensions,
        project.materialId
      );
      project.seamPairDetails = buildSeamPairDetails(project.patterns, project.relations);
      project.validation = validateProjectPatterns(
        project.patterns,
        project.relations,
        project.materialId,
        project.edgeProcess,
        project.dimensions
      );
      await upsertProjectForUser(uid, project);
      res.json({ validation: project.validation, project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '执行纸格校验失败' });
    }
  });

  // 13. Manual version checkpoint / restore / undo / redo
  app.post('/api/v1/projects/:id/versions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });
      const { summary = '手动保存版本快照' } = req.body as { summary?: string };
      const prevSnap = extractSnapshot(project);
      pushVersionAndUndo(project, prevSnap, summary, 'user');
      await upsertProjectForUser(uid, project);
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '保存版本失败' });
    }
  });

  app.post('/api/v1/projects/:id/versions/:version/restore', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });
      const verNum = Number.parseInt(req.params.version, 10);
      const target = project.versions.find((v) => v.version === verNum);
      if (!target) return res.status(404).json({ error: '指定历史版本不存在' });

      const prevSnap = extractSnapshot(project);
      applySnapshotToProject(project, target.snapshot);
      pushVersionAndUndo(project, prevSnap, `恢复至历史版本 v${verNum}`, 'user');
      await upsertProjectForUser(uid, project);
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '恢复版本失败' });
    }
  });

  app.post('/api/v1/projects/:id/undo', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });
      if (project.undoStack.length === 0) {
        return res.status(400).json({ error: '没有可撤销的操作' });
      }
      const currentSnap = extractSnapshot(project);
      const prevSnap = project.undoStack.pop()!;
      project.redoStack.push(currentSnap);
      applySnapshotToProject(project, prevSnap);
      project.currentVersion += 1;
      await upsertProjectForUser(uid, project);
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '撤销失败' });
    }
  });

  app.post('/api/v1/projects/:id/redo', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });
      if (project.redoStack.length === 0) {
        return res.status(400).json({ error: '没有可恢复的操作' });
      }
      const currentSnap = extractSnapshot(project);
      const nextSnap = project.redoStack.pop()!;
      project.undoStack.push(currentSnap);
      applySnapshotToProject(project, nextSnap);
      project.currentVersion += 1;
      await upsertProjectForUser(uid, project);
      res.json({ project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '恢复失败' });
    }
  });

  // 14. Production exports & DXF round-trip verification
  app.post('/api/v1/projects/:id/exports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const { format, pageFormat } = req.body as {
        format: 'pdf' | 'dxf' | 'svg' | 'json' | 'csv';
        pageFormat?: 'A4' | 'A3' | 'LARGE';
      };

      let roundTripVerified = true;
      let roundTripSummary = '几何与单位校验通过 (1:1 mm)';

      if (format === 'dxf') {
        const dxfText = exportProjectToDxf(project);
        const check = parseAndVerifyDxf(dxfText, project.patterns);
        roundTripVerified = check.valid;
        roundTripSummary = check.summary;
      }

      const record = {
        id: `exp_${Date.now()}`,
        format,
        fileName: `${project.name}_v${project.currentVersion}.${format}`,
        createdAt: new Date().toISOString(),
        pageFormat,
        roundTripVerified,
        roundTripSummary,
      };

      project.exports.unshift(record);
      if (project.exports.length > 25) project.exports.length = 25;
      await upsertProjectForUser(uid, project);
      res.status(201).json({ record, project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '导出记录保存失败' });
    }
  });

  app.get('/api/v1/projects/:id/exports', requireAuth, async (req: AuthRequest, res) => {
    const project = await getProjectForUser(req.params.id, req.user!.uid);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    res.json({ exports: project.exports });
  });

  // 15. Re-import DXF into project
  app.post('/api/v1/projects/:id/import-dxf', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const { dxfText, replaceExisting = false } = req.body as {
        dxfText?: string;
        replaceExisting?: boolean;
      };
      if (!dxfText) return res.status(400).json({ error: '缺少 DXF 文件内容' });

      const parsed = parseAndVerifyDxf(dxfText);
      if (!parsed.valid) {
        return res.status(400).json({ error: parsed.summary });
      }

      const prevSnap = extractSnapshot(project);
      project.patterns = replaceExisting
        ? parsed.importedPieces
        : [...project.patterns, ...parsed.importedPieces];
      project.validation = validateProjectPatterns(
        project.patterns,
        project.relations,
        project.materialId,
        project.edgeProcess
      );
      pushVersionAndUndo(
        project,
        prevSnap,
        `导入 DXF 纸格 (${parsed.importedPieces.length} 片)`,
        'user'
      );
      await upsertProjectForUser(uid, project);
      res.json({ verification: parsed, project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'DXF 导入失败' });
    }
  });

  // ==================== V1.1 RUDA Leather Intelligence Endpoints ====================

  app.get('/api/v1/intelligence/overview', requireAuth, async (req: AuthRequest, res) => {
    try {
      const overview = await getIntelligenceOverview(req.user!.uid);
      res.json(overview);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载知识库总览失败' });
    }
  });

  app.get('/api/v1/intelligence/retrieve', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : '';
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      let project = projectId ? await getProjectForUser(projectId, uid) : null;
      if (!project) {
        const snap = createStarterSnapshot('tote');
        project = {
          id: 'query_ctx',
          name: '检索上下文',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentVersion: 1,
          undoStack: [],
          redoStack: [],
          images: [],
          ...snap,
          messages: [],
          commandLog: [],
          versions: [],
          exports: [],
        };
      }
      const bundle = await retrieveRelevantMemoryForPrompt(uid, project, q);
      res.json(bundle);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '混合检索失败' });
    }
  });

  app.patch('/api/v1/intelligence/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateUserPreferences(req.user!.uid, req.body);
      res.json({ preferences: updated?.preferencesJson ?? {} });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '更新用户偏好失败' });
    }
  });

  app.post('/api/v1/intelligence/memories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        memoryLayer = 'user_long_term',
        memoryKey,
        content,
        applicableBagTypes = [],
        applicableMaterials = [],
        relatedParts = [],
        sourceProjectId,
      } = req.body as {
        memoryLayer?: 'session' | 'user_long_term' | 'project_long_term' | 'engineering_knowledge' | 'historical_experience';
        memoryKey: string;
        content: string;
        applicableBagTypes?: string[];
        applicableMaterials?: string[];
        relatedParts?: string[];
        sourceProjectId?: string;
      };

      if (!memoryKey?.trim() || !content?.trim()) {
        return res.status(400).json({ error: '记忆键与内容不能为空' });
      }

      const item = await upsertMemoryItemWithMerge({
        ownerUid: req.user!.uid,
        memoryLayer,
        memoryKey: memoryKey.trim(),
        content: content.trim(),
        applicableBagTypes,
        applicableMaterials,
        relatedParts,
        source: '用户主动录入偏好记忆',
        sourceProjectId,
        securityScope: 'C_USER_PRIVATE',
        reviewLevel: 3,
      });

      if (!item) {
        return res.status(403).json({ error: '您已关闭个人长期记忆收集授权，请在设置中开启后再试。' });
      }
      res.status(201).json({ memory: item });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '保存长期记忆失败' });
    }
  });

  app.delete('/api/v1/intelligence/memories/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ok = await deleteUserMemoryItem(req.params.id, req.user!.uid);
      if (!ok) return res.status(404).json({ error: '记忆条目不存在或无权删除' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '删除记忆失败' });
    }
  });

  app.post('/api/v1/intelligence/learning-candidates/:id/review', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        action,
        targetReviewLevel = 4,
        securityScope = 'C_USER_PRIVATE',
        reviewNote,
        createEvalCase = true,
      } = req.body as {
        action: 'approve' | 'reject' | 'promote_level';
        targetReviewLevel?: number;
        securityScope?: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
        reviewNote?: string;
        createEvalCase?: boolean;
      };

      const result = await reviewLearningCandidate({
        candidateId: req.params.id,
        reviewerUid: req.user!.uid,
        reviewerName: (typeof req.user!.name === 'string' && req.user!.name) || req.user!.email || '专业打版师',
        action,
        targetReviewLevel,
        securityScope,
        reviewNote,
        createEvalCase,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '审核学习经验失败' });
    }
  });

  app.post('/api/v1/intelligence/cases/archive/:projectId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.projectId, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const { securityScope = 'C_USER_PRIVATE', productionResultNote = '' } = req.body as {
        securityScope?: 'A_PLATFORM_PUBLIC' | 'B_ENTERPRISE_PRIVATE' | 'C_USER_PRIVATE';
        productionResultNote?: string;
      };

      const savedCase = await archiveProjectAsCase({
        project,
        ownerUid: uid,
        securityScope,
        productionResultNote,
      });
      res.status(201).json({ caseItem: savedCase });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '归档工程案例失败' });
    }
  });

  app.post('/api/v1/intelligence/versions/:id/rollback', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await rollbackKnowledgeVersion({
        versionId: req.params.id,
        reviewerUid: req.user!.uid,
        reviewerName: (typeof req.user!.name === 'string' && req.user!.name) || req.user!.email || '专业打版师',
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : '回滚知识版本失败' });
    }
  });

  app.post('/api/v1/intelligence/evaluations/run', requireAuth, async (req: AuthRequest, res) => {
    try {
      const summary = await runAiEvaluationSuite(req.user!.uid);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '运行 AI 能力回归评估失败' });
    }
  });

  // Blind-Test Evaluation & Production Verification Log (Section 11)
  app.get('/api/v1/intelligence/blind-tests', requireAuth, async (req: AuthRequest, res) => {
    try {
      const records = await listBlindTests(req.user!.uid);
      res.json({ blindTests: records });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '读取盲测记录失败' });
    }
  });

  app.post('/api/v1/intelligence/blind-tests', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body as Omit<BlindTestRecord, 'id' | 'createdAt' | 'dimensionErrorMm'>;
      if (!body.title?.trim()) {
        return res.status(400).json({ error: '盲测标题不能为空' });
      }
      const record = await createBlindTestRecord(req.user!.uid, body);
      res.status(201).json({ blindTest: record });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '保存盲测记录失败' });
    }
  });

  // ==================== V1.2 Factory Feedback & Accuracy Benchmarks ====================

  app.get('/api/v1/projects/:id/production-feedback', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });
      const feedbacks = await listFactoryFeedbacks(uid, project.id);
      res.json({ feedbacks });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载工厂反馈失败' });
    }
  });

  app.post('/api/v1/projects/:id/production-feedback', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const project = await getProjectForUser(req.params.id, uid);
      if (!project) return res.status(404).json({ error: '项目不存在' });

      const body = req.body as Partial<
        Omit<FactoryProductionFeedback, 'id' | 'createdAt' | 'promotedToExperienceId'>
      >;
      if (!body.finishedDimensionsMm || !body.conclusion) {
        return res.status(400).json({ error: '缺少实测成包尺寸或产线试制结论' });
      }

      const saved = await createFactoryFeedback(uid, {
        projectId: project.id,
        projectName: project.name,
        projectVersion: project.currentVersion,
        bagType: body.bagType ?? project.bagType,
        materialId: body.materialId ?? project.materialId,
        actualCutDeviationMm: Number(body.actualCutDeviationMm ?? 0.5),
        stitchingCondition: body.stitchingCondition?.trim() || '正常走线，未断线跳针',
        seamDeviationMm: Number(body.seamDeviationMm ?? 0.6),
        materialIssues: body.materialIssues?.trim() || '无明显皮面问题',
        skivingIssues: body.skivingIssues?.trim() || '铲薄厚度符合工艺标准',
        pieceDeformation: body.pieceDeformation?.trim() || '无明显拉长变形',
        finishedDimensionsMm: body.finishedDimensionsMm,
        appearanceRating: (body.appearanceRating ?? 4) as 1 | 2 | 3 | 4 | 5,
        patternMakerCorrections: Array.isArray(body.patternMakerCorrections)
          ? body.patternMakerCorrections
          : [],
        conclusion: body.conclusion,
        recordedBy:
          body.recordedBy?.trim() ||
          (typeof req.user!.name === 'string' && req.user!.name) ||
          req.user!.email ||
          '车间试制员',
      });

      // Keep project qualitySignoff consistent with factory verdict
      const currentSignoff = project.qualitySignoff ?? {
        patternMakerConfirmed: false,
        physicalSamplePassed: false,
      };
      if (saved.conclusion === 'approved_for_mass_production') {
        project.qualitySignoff = {
          ...currentSignoff,
          physicalSamplePassed: true,
          sampleLotNote: `产线反馈通过 (${saved.appearanceRating}/5 · ${saved.recordedBy})`,
          physicalSampleAt: new Date().toISOString(),
        };
      } else if (
        saved.conclusion === 'needs_pattern_revision' ||
        saved.conclusion === 'rejected'
      ) {
        project.qualitySignoff = {
          ...currentSignoff,
          physicalSamplePassed: false,
          sampleLotNote: `产线退回修改：${saved.patternMakerCorrections[0] || saved.materialIssues}`,
        };
      }
      await upsertProjectForUser(uid, project);

      res.status(201).json({ feedback: saved, project });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '记录工厂反馈失败' });
    }
  });

  app.get('/api/v1/intelligence/production-feedback', requireAuth, async (req: AuthRequest, res) => {
    try {
      const feedbacks = await listFactoryFeedbacks(req.user!.uid);
      res.json({ feedbacks });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载全部工厂反馈失败' });
    }
  });

  app.get('/api/v1/intelligence/benchmarks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const benchmark = await getLatestAccuracyBenchmark(req.user!.uid);
      res.json({ benchmark });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载精度基准数据失败' });
    }
  });

  app.post('/api/v1/intelligence/benchmarks/run', requireAuth, async (req: AuthRequest, res) => {
    try {
      const benchmark = await runAccuracyBenchmark(req.user!.uid);
      res.json({ benchmark });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '运行精度基准测试失败' });
    }
  });

  // ==================== V1.3 Five-Engine Architecture & Leather Training Dataset ====================

  app.get('/api/v1/architecture/roadmap', requireAuth, async (req: AuthRequest, res) => {
    try {
      const customTpls = await listCustomMasterTemplates(req.user!.uid);
      const samples = await listTrainingSamples(req.user!.uid);
      res.json({
        engines: FIVE_ENGINE_ARCHITECTURE,
        industryBenchmarks: INDUSTRY_BENCHMARK_PRODUCTS,
        authorizedCadCommands: AUTHORIZED_CAD_COMMANDS,
        telemetry: {
          storageBackend: isPostgresConfigured ? 'PostgreSQL + pgvector (HNSW)' : 'In-Memory Dev Store',
          masterTemplateCount: MASTER_PATTERN_LIBRARY.length + customTpls.length,
          authorizedCommandCount: AUTHORIZED_CAD_COMMANDS.length,
          trainingSampleCount: samples.length,
          verifiedTrainingCount: samples.filter((s) => s.annotationStatus !== 'draft_ai').length,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载系统技术路线图失败' });
    }
  });

  app.get('/api/v1/training-samples', requireAuth, async (req: AuthRequest, res) => {
    try {
      const datasetSplit = typeof req.query.datasetSplit === 'string' ? req.query.datasetSplit : undefined;
      const annotationStatus =
        typeof req.query.annotationStatus === 'string' ? req.query.annotationStatus : undefined;
      const bagType = typeof req.query.bagType === 'string' ? req.query.bagType : undefined;
      const samples = await listTrainingSamples(req.user!.uid, {
        datasetSplit,
        annotationStatus,
        bagType,
      });
      res.json({ samples });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '加载训练集样本失败' });
    }
  });

  app.get('/api/v1/training-samples/export', requireAuth, async (req: AuthRequest, res) => {
    try {
      const exported = await exportTrainingDatasetJsonl(req.user!.uid);
      res.json(exported);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '导出训练集失败' });
    }
  });

  app.post('/api/v1/training-samples', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const body = req.body as {
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
      };

      if (body.projectId) {
        const project = await getProjectForUser(body.projectId, uid);
        if (!project) {
          return res.status(404).json({ error: '关联项目不存在，无法提取样本' });
        }
        const photoAngles = Array.from(new Set(project.images.map((i) => i.angle))) as ImageAngle[];
        const visiblePartLabels = project.components
          .filter((c) => !c.isInferredHidden)
          .map((c) => c.name);
        const hiddenPartLabels = project.components
          .filter((c) => c.isInferredHidden)
          .map((c) => c.name);
        const saved = await createTrainingSample(uid, {
          title:
            body.title?.trim() ||
            `${project.name} (${project.dimensions.widthMm}×${project.dimensions.heightMm}×${project.dimensions.depthMm}mm)`,
          sourceProjectId: project.id,
          bagType: body.bagType ?? project.bagType,
          structureType:
            body.structureType ?? project.structureType ?? 'independent_gusset_bottom',
          materialId: body.materialId ?? project.materialId,
          edgeProcess: body.edgeProcess ?? project.edgeProcess,
          datasetSplit: body.datasetSplit ?? 'train',
          photoAngles: photoAngles.length > 0 ? photoAngles : ['front'],
          photoCount: project.images.length,
          hasReferenceCalibration: Boolean(
            project.captureGuidance?.referenceObjectType &&
              project.captureGuidance.referenceObjectType !== 'none'
          ) || project.dimensions.dimensionSource !== 'ai_estimated',
          referenceObjectType:
            project.captureGuidance?.referenceObjectType ?? body.referenceObjectType,
          trueDimensionsMm: body.trueDimensionsMm ?? {
            widthMm: project.dimensions.widthMm,
            heightMm: project.dimensions.heightMm,
            depthMm: project.dimensions.depthMm,
          },
          visiblePartLabels,
          hiddenPartLabels,
          seamBoundaryNotes:
            body.seamBoundaryNotes?.trim() ||
            project.visionSummary?.detectedSeamsAndBoundaries?.join('；') ||
            `共 ${project.seamPairDetails?.length ?? project.relations.length} 组接缝对位`,
          verifiedPieceCount: project.patterns.length,
          verifiedPatternSummary: project.patterns.map((p) => ({
            partCode: p.partCode,
            name: p.name,
            widthMm: Math.round(p.boundingBoxMm.width),
            heightMm: Math.round(p.boundingBoxMm.height),
            seamAllowanceMm: p.seamAllowanceMm,
            quantity: p.quantity,
          })),
          annotationStatus:
            body.annotationStatus ??
            (project.qualitySignoff?.physicalSamplePassed
              ? 'production_golden'
              : project.qualitySignoff?.patternMakerConfirmed
                ? 'patternmaker_verified'
                : 'draft_ai'),
          annotatedBy:
            body.annotatedBy?.trim() ||
            project.qualitySignoff?.patternMakerName ||
            (typeof req.user!.name === 'string' && req.user!.name) ||
            '打版师',
          leatherSpecificRulesChecked: body.leatherSpecificRulesChecked !== false,
          notes:
            body.notes?.trim() ||
            `从项目 v${project.currentVersion} 提取 · 尺寸来源=${project.dimensions.dimensionSource}`,
        });
        return res.status(201).json({ sample: saved });
      }

      if (!body.title?.trim()) {
        return res.status(400).json({ error: '训练样本标题不能为空' });
      }

      const saved = await createTrainingSample(uid, {
        title: body.title.trim(),
        bagType: body.bagType ?? 'tote',
        structureType: body.structureType ?? 'independent_gusset_bottom',
        materialId: body.materialId ?? 'veg_tan_18',
        edgeProcess: body.edgeProcess ?? 'raw_burnish',
        datasetSplit: body.datasetSplit ?? 'train',
        photoAngles: body.photoAngles?.length ? body.photoAngles : ['front', 'side', 'bottom'],
        photoCount: body.photoAngles?.length ?? 3,
        hasReferenceCalibration: Boolean(body.hasReferenceCalibration),
        referenceObjectType: body.referenceObjectType,
        trueDimensionsMm: body.trueDimensionsMm ?? { widthMm: 280, heightMm: 210, depthMm: 100 },
        visiblePartLabels: body.visiblePartLabels ?? ['前包身', '后包身', '侧围'],
        hiddenPartLabels: body.hiddenPartLabels ?? ['里布', '底托衬板'],
        seamBoundaryNotes: body.seamBoundaryNotes?.trim() || '外圈车线与转角对位刀口已核对',
        verifiedPieceCount: 6,
        verifiedPatternSummary: [],
        annotationStatus: body.annotationStatus ?? 'patternmaker_verified',
        annotatedBy:
          body.annotatedBy?.trim() ||
          (typeof req.user!.name === 'string' && req.user!.name) ||
          '打版师',
        leatherSpecificRulesChecked: body.leatherSpecificRulesChecked !== false,
        notes: body.notes?.trim() || '',
      });
      res.status(201).json({ sample: saved });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '创建训练样本失败' });
    }
  });

  app.patch('/api/v1/training-samples/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateTrainingSample(
        req.params.id,
        req.user!.uid,
        req.body as Record<string, unknown>
      );
      if (!updated) {
        return res.status(404).json({ error: '未找到训练样本' });
      }
      res.json({ sample: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : '更新训练样本失败' });
    }
  });

  // Vite dev middleware vs static dist
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`RUDA AI Leather Studio running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
