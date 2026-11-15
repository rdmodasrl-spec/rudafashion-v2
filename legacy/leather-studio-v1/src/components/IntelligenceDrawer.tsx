import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  BookOpen,
  Check,
  History,
  Loader2,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  api,
  type ArchitectureRoadmapResponse,
  type EvaluationRunSummary,
  type IntelligenceOverviewResponse,
} from '../api/client';
import {
  BAG_TYPE_LABELS,
  EDGE_PROCESS_LABELS,
  MATERIAL_LIBRARY,
  STRUCTURE_TYPE_LABELS,
} from '../shared/leatherKnowledge';
import { MASTER_PATTERN_LIBRARY, searchMasterTemplates } from '../shared/masterPatternLibrary';
import type {
  AccuracyBenchmarkSummary,
  BagType,
  BenchmarkSplit,
  BlindTestRecord,
  EdgeProcessType,
  MasterPatternTemplate,
  Project,
  StructureType,
  TrainingAnnotationStatus,
  TrainingSampleRecord,
} from '../shared/types';

type IntelTab =
  | 'memories'
  | 'templates'
  | 'knowledge'
  | 'cases'
  | 'blind_tests'
  | 'learning'
  | 'evaluation'
  | 'admin_workbench'
  | 'architecture'
  | 'training_dataset';

interface IntelligenceDrawerProps {
  activeProject: Project | null;
  onClose: () => void;
  onNotify: (msg: string) => void;
  onApplyTemplate?: (templateId: string, keepCustomDimensions?: boolean) => Promise<void>;
  onTemplatesChanged?: () => void;
}

const REVIEW_LEVEL_TEXT: Record<number, string> = {
  1: 'LEVEL 1 · AI 推测（仅供参考）',
  2: 'LEVEL 2 · 几何验证',
  3: 'LEVEL 3 · 用户确认',
  4: 'LEVEL 4 · 专业打版师审核',
  5: 'LEVEL 5 · 实际生产验证',
};

const SCOPE_TEXT: Record<string, string> = {
  A_PLATFORM_PUBLIC: 'A 类 · 全平台共享知识',
  B_ENTERPRISE_PRIVATE: 'B 类 · 企业私有知识',
  C_USER_PRIVATE: 'C 类 · 用户个人设计',
  D_AI_CANDIDATE: 'D 类 · AI 待审核经验',
};

const CLASSIFICATION_TEXT: Record<string, string> = {
  project_specific: '单项目特殊要求',
  user_preference: '用户个人偏好',
  reusable_experience: '可复用专业经验',
  general_rule_candidate: '通用工程规则候选',
};

export const IntelligenceDrawer: React.FC<IntelligenceDrawerProps> = ({
  activeProject,
  onClose,
  onNotify,
  onApplyTemplate,
  onTemplatesChanged,
}) => {
  const [tab, setTab] = useState<IntelTab>('memories');
  const [data, setData] = useState<IntelligenceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Layer 2 new memory draft
  const [memoryKey, setMemoryKey] = useState('');
  const [memoryContent, setMemoryContent] = useState('');

  // Archive case state
  const [archiveScope, setArchiveScope] = useState<'C_USER_PRIVATE' | 'A_PLATFORM_PUBLIC'>(
    'C_USER_PRIVATE'
  );
  const [archiveNote, setArchiveNote] = useState('');

  // Evaluation & V1.2 Accuracy Benchmark state
  const [evalSummary, setEvalSummary] = useState<EvaluationRunSummary | null>(null);
  const [benchmarkSummary, setBenchmarkSummary] = useState<AccuracyBenchmarkSummary | null>(null);

  // Hybrid search test inside Knowledge tab
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<string[] | null>(null);

  // Master Pattern Library 5-axis filter + expandable archive
  const [tplBagFilter, setTplBagFilter] = useState<'all' | BagType>('all');
  const [tplStructFilter, setTplStructFilter] = useState<'all' | StructureType>('all');
  const [tplMatFilter, setTplMatFilter] = useState<string>('all');
  const [tplEdgeFilter, setTplEdgeFilter] = useState<string>('all');
  const [tplPartQuery, setTplPartQuery] = useState('');
  const [expandedTplId, setExpandedTplId] = useState<string | null>(null);

  // Blind test submission draft + 4 separated proof toggles
  const [btTitle, setBtTitle] = useState('');
  const [btBagType, setBtBagType] = useState<BagType>('handbag');
  const [btTemplateId, setBtTemplateId] = useState('tpl_handbag_trapezoid_flap');
  const [btPhotoCount, setBtPhotoCount] = useState(2);
  const [btActualW, setBtActualW] = useState(260);
  const [btActualH, setBtActualH] = useState(195);
  const [btActualD, setBtActualD] = useState(105);
  const [btAiW, setBtAiW] = useState(255);
  const [btAiH, setBtAiH] = useState(190);
  const [btAiD, setBtAiD] = useState(100);
  const [btOutcome, setBtOutcome] =
    useState<BlindTestRecord['physicalSampleOutcome']>('passed');
  const [btMaxSeamDiff, setBtMaxSeamDiff] = useState(0.8);
  const [btCorrections, setBtCorrections] = useState('');
  const [btNotes, setBtNotes] = useState('');
  const [btProofAi, setBtProofAi] = useState(true);
  const [btProof2D, setBtProof2D] = useState(true);
  const [btProofSeams, setBtProofSeams] = useState(true);
  const [btProofPhysical, setBtProofPhysical] = useState(true);

  // Patternmaker Admin Workbench state
  const [admSourceMode, setAdmSourceMode] = useState<'project' | 'dxf' | 'scratch'>(
    activeProject ? 'project' : 'scratch'
  );
  const [admName, setAdmName] = useState('');
  const [admBagType, setAdmBagType] = useState<BagType>(activeProject?.bagType ?? 'tote');
  const [admStructType, setAdmStructType] = useState<StructureType>(
    activeProject?.structureType ?? 'independent_gusset_bottom'
  );
  const [admVersion, setAdmVersion] = useState('V1.0-CUSTOM');
  const [admStatus, setAdmStatus] = useState<'draft' | 'published'>('published');
  const [admVerifier, setAdmVerifier] = useState('陈工（打版主管）');
  const [admSummary, setAdmSummary] = useState('');
  const [admDxfText, setAdmDxfText] = useState('');

  // V1.3 Five-Engine Architecture & Industry Comparison + Leather Training Dataset state
  const [roadmap, setRoadmap] = useState<ArchitectureRoadmapResponse | null>(null);
  const [tsSplitFilter, setTsSplitFilter] = useState<'all' | BenchmarkSplit>('all');
  const [tsTitle, setTsTitle] = useState('');
  const [tsBagType, setTsBagType] = useState<BagType>(activeProject?.bagType ?? 'tote');
  const [tsStructType, setTsStructType] = useState<StructureType>(
    activeProject?.structureType ?? 'independent_gusset_bottom'
  );
  const [tsMaterialId, setTsMaterialId] = useState(activeProject?.materialId ?? 'veg_tan_18');
  const [tsEdgeProcess, setTsEdgeProcess] = useState<EdgeProcessType>(
    activeProject?.edgeProcess ?? 'raw_burnish'
  );
  const [tsSplit, setTsSplit] = useState<BenchmarkSplit>('train');
  const [tsW, setTsW] = useState(activeProject?.dimensions.widthMm ?? 300);
  const [tsH, setTsH] = useState(activeProject?.dimensions.heightMm ?? 240);
  const [tsD, setTsD] = useState(activeProject?.dimensions.depthMm ?? 120);
  const [tsVisibleParts, setTsVisibleParts] = useState('前包身，后包身，独立侧围，提手');
  const [tsHiddenParts, setTsHiddenParts] = useState('里布，拉链内袋，底托加固板');
  const [tsSeamNotes, setTsSeamNotes] = useState('');
  const [tsAnnotator, setTsAnnotator] = useState('陈工（首席皮具打版师）');
  const [tsLeatherChecked, setTsLeatherChecked] = useState(true);
  const [tsNotes, setTsNotes] = useState('');
  const [jsonlPreview, setJsonlPreview] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [res, roadmapRes] = await Promise.all([
        api.getIntelligenceOverview(),
        api.getArchitectureRoadmap().catch(() => null),
      ]);
      setData(res);
      if (res.latestBenchmark) {
        setBenchmarkSummary(res.latestBenchmark);
      }
      if (roadmapRes) {
        setRoadmap(roadmapRes);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '加载知识与记忆系统失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleToggleConsent = async (enabled: boolean) => {
    if (!data) return;
    setBusyAction('consent');
    try {
      const { preferences } = await api.updatePreferences({
        ...data.userPreferences,
        memoryConsentEnabled: enabled,
      });
      setData({ ...data, userPreferences: preferences });
      onNotify(enabled ? '已开启个人长期记忆学习授权' : '已关闭个人长期记忆记录');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '更新授权失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTogglePreferredMaterial = async (materialId: string) => {
    if (!data) return;
    setBusyAction(`mat_${materialId}`);
    try {
      const curr = new Set(data.userPreferences.preferredMaterials ?? []);
      if (curr.has(materialId)) {
        curr.delete(materialId);
      } else {
        curr.add(materialId);
      }
      const { preferences } = await api.updatePreferences({
        ...data.userPreferences,
        preferredMaterials: Array.from(curr),
      });
      setData({ ...data, userPreferences: preferences });
      onNotify('已更新常用皮料偏好');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '更新材料偏好失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryKey.trim() || !memoryContent.trim()) return;
    setBusyAction('add_mem');
    setErrorMsg(null);
    try {
      await api.upsertMemory({
        memoryLayer: 'user_long_term',
        memoryKey: memoryKey.trim(),
        content: memoryContent.trim(),
        applicableBagTypes: activeProject ? [activeProject.bagType] : [],
        applicableMaterials: activeProject ? [activeProject.materialId] : [],
        sourceProjectId: activeProject?.id,
      });
      setMemoryKey('');
      setMemoryContent('');
      await loadOverview();
      onNotify('已保存至用户长期记忆');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存长期记忆失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    setBusyAction(`del_${id}`);
    try {
      await api.deleteMemory(id);
      await loadOverview();
      onNotify('已删除该条个人记忆');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '删除记忆失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleHybridSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setBusyAction('search');
    try {
      const res = await api.retrieveMemory(activeProject?.id ?? '', searchQuery.trim());
      const hits = [
        ...res.engineeringKnowledge.map((k) => `[专业知识 L${k.reviewLevel}] ${k.title} — ${k.content}`),
        ...res.similarCases.map((c) => `[历史案例 L${c.reviewLevel}] ${c.title}`),
        ...res.experienceRecords.map((x) => `[错题修复 L${x.reviewLevel}] ${x.errorLocation} -> ${x.fixMethod}`),
      ];
      setSearchResults(hits);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '混合检索引擎查询失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleReviewCandidate = async (
    id: string,
    action: 'approve' | 'reject',
    targetReviewLevel = 4
  ) => {
    setBusyAction(`rev_${id}`);
    setErrorMsg(null);
    try {
      await api.reviewLearningCandidate(id, {
        action,
        targetReviewLevel,
        securityScope: targetReviewLevel >= 4 ? 'A_PLATFORM_PUBLIC' : 'C_USER_PRIVATE',
        createEvalCase: action === 'approve',
      });
      await loadOverview();
      onNotify(
        action === 'approve'
          ? `已核准升级至 LEVEL ${targetReviewLevel}，并同步生成新知识版本与测试案例`
          : '已驳回该条待审核经验'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '审核操作失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRollbackVersion = async (versionId: string) => {
    setBusyAction(`rb_${versionId}`);
    setErrorMsg(null);
    try {
      await api.rollbackKnowledgeVersion(versionId);
      await loadOverview();
      onNotify('已安全回滚该知识版本，未影响历史已验证设计');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '版本回滚失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchiveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    setBusyAction('archive_case');
    setErrorMsg(null);
    try {
      await api.archiveProjectCase(activeProject.id, {
        securityScope: archiveScope,
        productionResultNote: archiveNote.trim(),
      });
      setArchiveNote('');
      await loadOverview();
      onNotify('已将当前项目归档至工程案例库');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '归档项目案例失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunEvaluation = async () => {
    setBusyAction('eval');
    setErrorMsg(null);
    try {
      const summary = await api.runEvaluationSuite();
      setEvalSummary(summary);
      await loadOverview();
      onNotify(
        summary.allowedToDeploy
          ? `10 项 AI 能力评估全部通过（${summary.passedCount}/${summary.totalTests}）`
          : '检测到能力退化，已阻断知识发布'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '运行评估测试集失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunBenchmark = async () => {
    setBusyAction('benchmark');
    setErrorMsg(null);
    try {
      const { benchmark } = await api.runAccuracyBenchmark();
      setBenchmarkSummary(benchmark);
      await loadOverview();
      onNotify(`精度基准测评完成（封存测试集通过率 ${benchmark.splitsSummary.sealed_test.passRatePct}%）`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '运行精度基准测评失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('create_tpl');
    setErrorMsg(null);
    try {
      const { template } = await api.createMasterTemplate({
        name: admName.trim() || undefined,
        bagType: admBagType,
        structureType: admStructType,
        templateVersion: admVersion.trim() || 'V1.0-CUSTOM',
        status: admStatus,
        verifiedBy: admVerifier.trim() || '专业打版师',
        summary: admSummary.trim() || undefined,
        projectId: admSourceMode === 'project' && activeProject ? activeProject.id : undefined,
        dxfText: admSourceMode === 'dxf' ? admDxfText : undefined,
      });
      setAdmName('');
      setAdmSummary('');
      setAdmDxfText('');
      await loadOverview();
      onTemplatesChanged?.();
      onNotify(`已创建标准模板「${template.name}」(${template.status === 'published' ? '已发布' : '草稿'})`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '创建标准模板失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleTemplateStatus = async (
    tpl: MasterPatternTemplate,
    nextStatus: 'published' | 'draft' | 'archived'
  ) => {
    setBusyAction(`tpl_stat_${tpl.id}`);
    setErrorMsg(null);
    try {
      await api.updateMasterTemplate(tpl.id, { status: nextStatus });
      await loadOverview();
      onTemplatesChanged?.();
      onNotify(`模板「${tpl.name}」状态已更新为 ${nextStatus}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '更新模板状态失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateBlindTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!btTitle.trim()) return;
    setBusyAction('create_bt');
    setErrorMsg(null);
    try {
      const tpl = MASTER_PATTERN_LIBRARY.find((t) => t.id === btTemplateId);
      await api.createBlindTest({
        title: btTitle.trim(),
        bagType: btBagType,
        structureType: (tpl?.structureType || 'trapezoid_flap_frame') as StructureType,
        photoCount: btPhotoCount,
        actualDimensionsMm: { widthMm: btActualW, heightMm: btActualH, depthMm: btActualD },
        aiInitialDimensionsMm: { widthMm: btAiW, heightMm: btAiH, depthMm: btAiD },
        matchedTemplateId: btTemplateId,
        aiInitialSummary: `盲测初版生成 (${tpl?.name || btTemplateId})`,
        manualCorrections: btCorrections
          .split(/[；;。\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        physicalSampleOutcome: btOutcome,
        maxSeamDiffMm: btMaxSeamDiff,
        completenessScore: btOutcome === 'passed' ? 0.94 : 0.85,
        processReasonable: btProofSeams,
        aiRecognitionPassed: btProofAi,
        geometry2DPassed: btProof2D,
        seamsAndProcessPassed: btProofSeams,
        physicalProductionPassed: btProofPhysical,
        testerNotes: btNotes.trim() || '已完成盲测实物对比验收',
      });
      setBtTitle('');
      setBtCorrections('');
      setBtNotes('');
      await loadOverview();
      onNotify('盲测记录已保存至训练验收数据库');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存盲测记录失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleExtractTrainingFromProject = async () => {
    if (!activeProject) return;
    setBusyAction('ts_extract');
    setErrorMsg(null);
    try {
      const { sample } = await api.createTrainingSample({
        projectId: activeProject.id,
        datasetSplit: tsSplit,
        annotatedBy: tsAnnotator.trim() || '打版师',
        leatherSpecificRulesChecked: tsLeatherChecked,
      });
      await loadOverview();
      onNotify(`已从当前项目提取样本「${sample.title}」进入 ${sample.datasetSplit} 集合`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '从项目提取训练样本失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateTrainingSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tsTitle.trim()) return;
    setBusyAction('ts_create');
    setErrorMsg(null);
    try {
      const parseParts = (txt: string) =>
        txt
          .split(/[，,、；;\n]/)
          .map((s) => s.trim())
          .filter(Boolean);
      const { sample } = await api.createTrainingSample({
        title: tsTitle.trim(),
        bagType: tsBagType,
        structureType: tsStructType,
        materialId: tsMaterialId,
        edgeProcess: tsEdgeProcess,
        datasetSplit: tsSplit,
        photoAngles: ['front', 'back', 'left', 'right', 'bottom'],
        hasReferenceCalibration: true,
        referenceObjectType: 'calibration_board',
        trueDimensionsMm: { widthMm: tsW, heightMm: tsH, depthMm: tsD },
        visiblePartLabels: parseParts(tsVisibleParts),
        hiddenPartLabels: parseParts(tsHiddenParts),
        seamBoundaryNotes: tsSeamNotes.trim() || '外圈车线与角位对位刀口已核对',
        annotationStatus: tsLeatherChecked ? 'patternmaker_verified' : 'draft_ai',
        annotatedBy: tsAnnotator.trim() || '打版师',
        leatherSpecificRulesChecked: tsLeatherChecked,
        notes: tsNotes.trim(),
      });
      setTsTitle('');
      setTsSeamNotes('');
      setTsNotes('');
      await loadOverview();
      onNotify(`已入库训练样本「${sample.title}」`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '创建训练样本失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateTrainingStatus = async (
    sample: TrainingSampleRecord,
    nextStatus: TrainingAnnotationStatus
  ) => {
    setBusyAction(`ts_stat_${sample.id}`);
    setErrorMsg(null);
    try {
      await api.updateTrainingSample(sample.id, { annotationStatus: nextStatus });
      await loadOverview();
      onNotify(`样本「${sample.title}」标注等级已更新`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '更新样本状态失败');
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportTrainingJsonl = async () => {
    setBusyAction('ts_export');
    setErrorMsg(null);
    try {
      const res = await api.exportTrainingDataset();
      setJsonlPreview(res.jsonl);
      const blob = new Blob([res.jsonl], { type: 'application/x-ndjson;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ruda_leather_training_dataset_${new Date().toISOString().slice(0, 10)}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify(`已导出 ${res.count} 条皮具视觉与标准纸格 JSONL 训练样本`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '导出 JSONL 训练集失败');
    } finally {
      setBusyAction(null);
    }
  };

  const pendingCandidatesCount =
    data?.learningCandidates.filter((c) => c.status === 'pending').length ?? 0;
  const blindTests = data?.blindTests ?? [];
  const customTemplates = data?.customTemplates ?? [];
  const factoryFeedbacks = data?.factoryFeedbacks ?? [];
  const trainingSamples = data?.trainingSamples ?? [];
  const filteredTrainingSamples =
    tsSplitFilter === 'all'
      ? trainingSamples
      : trainingSamples.filter((s) => s.datasetSplit === tsSplitFilter);
  const allTemplates = [...customTemplates, ...MASTER_PATTERN_LIBRARY];
  const filteredTemplates = searchMasterTemplates(allTemplates, {
    bagType: tplBagFilter === 'all' ? undefined : tplBagFilter,
    structureType: tplStructFilter === 'all' ? undefined : tplStructFilter,
    materialId: tplMatFilter === 'all' ? undefined : tplMatFilter,
    edgeProcess: tplEdgeFilter === 'all' ? undefined : tplEdgeFilter,
    partQuery: tplPartQuery,
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#141413]/45 flex items-center justify-center p-4">
      <div className="w-full max-w-[1080px] h-[86vh] bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E2DC] bg-[#FAF9F6] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 className="font-display text-base font-semibold text-[#141413]">
              RUDA Leather Intelligence · 专业知识库与长期记忆系统
            </h2>
            <p className="text-xs text-[#5C5B57] mt-0.5 font-mono tabular-nums">
              知识版本 {data?.knowledgeVersion ?? 'KB-2026.11-PRO'}
              <span aria-hidden="true"> · </span>
              五层记忆架构
              <span aria-hidden="true"> · </span>
              LEVEL 1–5 人工审核分级
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭知识与记忆系统"
            className="p-1.5 text-[#5C5B57] hover:text-[#141413] rounded hover:bg-[#ECEAE3] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-[#E4E2DC] bg-[#FFFFFF] flex items-center gap-5 overflow-x-auto shrink-0">
          {[
            { id: 'memories', label: '五层记忆与偏好' },
            { id: 'templates', label: `标准版型库 (${allTemplates.length})` },
            { id: 'knowledge', label: '专业知识库 (L1-L5)' },
            { id: 'cases', label: `案例与工厂反馈 (${factoryFeedbacks.length})` },
            { id: 'blind_tests', label: `盲测与验收 (${blindTests.length})` },
            {
              id: 'learning',
              label: `持续学习审核 (${pendingCandidatesCount})`,
            },
            { id: 'evaluation', label: '精度基准与回归' },
            { id: 'admin_workbench', label: '打版师工作台' },
            { id: 'architecture', label: '五引擎与行业对比' },
            { id: 'training_dataset', label: `视觉与纸格训练集 (${trainingSamples.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as IntelTab)}
              className={`py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                tab === t.id
                  ? 'border-[#9A4D22] text-[#9A4D22]'
                  : 'border-transparent text-[#5C5B57] hover:text-[#141413]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 px-3.5 py-2 text-xs bg-[#FEF2F2] border border-[#DC2626]/30 text-[#991B1B] rounded">
            {errorMsg}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading || !data ? (
            <div className="py-16 flex flex-col items-center justify-center text-sm text-[#5C5B57] gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#9A4D22]" />
              正在加载五层记忆与工程知识库...
            </div>
          ) : null}

          {/* TAB 1: Five-Layer Memory & Preferences */}
          {!loading && data && tab === 'memories' && (
            <div className="space-y-6">
              {/* Layer 2 User Consent & Preferred Materials */}
              <div className="border border-[#E4E2DC] rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#141413]">
                      第二层：用户长期记忆与授权控制
                    </h3>
                    <p className="text-xs text-[#5C5B57] mt-1">
                      记录您的常用皮料、工艺习惯与尺寸规则，仅归属您个人账户隔离保存（C 类隔离）。
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-[#141413] shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.userPreferences.memoryConsentEnabled !== false}
                      disabled={busyAction === 'consent'}
                      onChange={(e) => handleToggleConsent(e.target.checked)}
                      className="accent-[#9A4D22]"
                    />
                    允许积累个人长期记忆
                  </label>
                </div>

                <div>
                  <div className="text-xs font-medium text-[#5C5B57] mb-2">
                    常用主皮料偏好（新建项目时自动应用首选项）：
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MATERIAL_LIBRARY.filter(
                      (m) => m.category !== 'lining' && m.category !== 'reinforcement'
                    ).map((mat) => {
                      const active = (data.userPreferences.preferredMaterials ?? []).includes(
                        mat.id
                      );
                      return (
                        <button
                          key={mat.id}
                          type="button"
                          disabled={busyAction === `mat_${mat.id}`}
                          onClick={() => handleTogglePreferredMaterial(mat.id)}
                          className={`px-3 py-1.5 text-xs rounded border transition-colors whitespace-nowrap shrink-0 ${
                            active
                              ? 'bg-[#9A4D22] text-white border-[#9A4D22]'
                              : 'bg-[#FAF9F6] text-[#141413] border-[#D8D5CD] hover:border-[#9A4D22]'
                          }`}
                        >
                          {mat.name} ({mat.thicknessMm}mm)
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Layer 3 Active Project Memory Snapshot */}
              {activeProject && (
                <div className="border border-[#E4E2DC] rounded-lg p-5 bg-[#FAF9F6] space-y-2">
                  <h3 className="text-sm font-semibold text-[#141413]">
                    第三层：当前项目长期记忆（自动持久化与恢复）
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 text-xs">
                    <div>
                      <div className="text-[#78756E]">项目名称</div>
                      <div className="font-medium text-[#141413] mt-0.5 truncate">
                        {activeProject.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#78756E]">参考照片 / 视觉分析</div>
                      <div className="font-mono tabular-nums text-[#141413] mt-0.5">
                        {activeProject.images.length} 张 · {activeProject.visionSummary ? '已分析' : '未分析'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#78756E]">部件 / 纸格 / 连接关系</div>
                      <div className="font-mono tabular-nums text-[#141413] mt-0.5">
                        {activeProject.components.length} / {activeProject.patterns.length} /{' '}
                        {activeProject.relations.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#78756E]">修改历史 / 指令日志</div>
                      <div className="font-mono tabular-nums text-[#141413] mt-0.5">
                        {activeProject.versions.length} 版本 · {activeProject.commandLog.length} 指令
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Memory Form */}
              <form
                onSubmit={handleAddMemory}
                className="border border-[#E4E2DC] rounded-lg p-5 space-y-3"
              >
                <div className="text-sm font-semibold text-[#141413]">
                  新增个人设计规则 / 长期记忆（支持语义向量检索与同类自动合并）
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={memoryKey}
                    onChange={(e) => setMemoryKey(e.target.value)}
                    placeholder="记忆标识，如：tote_handle_drop"
                    className="px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D5CD] rounded focus:outline-none focus:border-[#9A4D22]"
                  />
                  <input
                    type="text"
                    value={memoryContent}
                    onChange={(e) => setMemoryContent(e.target.value)}
                    placeholder="内容，如：通勤托特包默认提手净高 230mm，方便肩背"
                    className="sm:col-span-2 px-3 py-2 text-xs bg-[#FAF9F6] border border-[#D8D5CD] rounded focus:outline-none focus:border-[#9A4D22]"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busyAction === 'add_mem' || !memoryKey.trim() || !memoryContent.trim()}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] disabled:opacity-45 rounded flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    写入长期记忆
                  </button>
                </div>
              </form>

              {/* Stored User Memories Table */}
              <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#FAF9F6] border-b border-[#E4E2DC] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#141413]">
                    已存储的个人记忆条目 ({data.memories.length})
                  </span>
                  <span className="text-xs text-[#78756E]">支持随时删除与来源追溯</span>
                </div>
                {data.memories.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#78756E]">
                    暂无已保存的个人长期记忆条目。在工作区调整材料或新增规则后将自动沉淀至此。
                  </div>
                ) : (
                  <div className="divide-y divide-[#ECEAE3]">
                    {data.memories.map((mem) => (
                      <div
                        key={mem.id}
                        className="px-4 py-3 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="text-xs font-medium text-[#141413]">
                            {mem.content}
                          </div>
                          <div className="text-[11px] text-[#78756E] font-mono tabular-nums flex flex-wrap items-center gap-x-2">
                            <span>键: {mem.memoryKey}</span>
                            <span aria-hidden="true">·</span>
                            <span>{REVIEW_LEVEL_TEXT[mem.reviewLevel] || `LEVEL ${mem.reviewLevel}`}</span>
                            <span aria-hidden="true">·</span>
                            <span>来源: {mem.source}</span>
                            <span aria-hidden="true">·</span>
                            <span>合并次数 {mem.mergedCount}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMemory(mem.id)}
                          disabled={busyAction === `del_${mem.id}`}
                          aria-label="删除记忆"
                          className="p-1.5 text-[#78756E] hover:text-[#DC2626] shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Master Pattern Library (5-Axis Filter + 13-Point Archive + Size Series) */}
          {!loading && data && tab === 'templates' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#141413]">
                    Master Pattern Library · 授权专业标准版型模板库 ({filteredTemplates.length}/{allTemplates.length} 套)
                  </h3>
                  <p className="text-xs text-[#5C5B57] mt-0.5">
                    支持按包型、结构、部件名称、皮料与工艺 5 维检索；每个模板保存 13 项工程档案与尺寸系列。
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      ['all', '全部'],
                      ['tote', '托特包'],
                      ['handbag', '手提包'],
                      ['shoulder_bag', '肩背包'],
                      ['wallet', '钱包'],
                      ['cardholder', '卡包'],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setTplBagFilter(k)}
                      className={`px-2.5 py-1 text-xs rounded border whitespace-nowrap shrink-0 ${
                        tplBagFilter === k
                          ? 'bg-[#9A4D22] text-white border-[#9A4D22]'
                          : 'bg-[#FAF9F6] text-[#5C5B57] border-[#D8D5CD] hover:text-[#141413]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5-Axis Search Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-[#FAF9F6] border border-[#E4E2DC] rounded-md p-3 text-xs">
                <input
                  type="text"
                  value={tplPartQuery}
                  onChange={(e) => setTplPartQuery(e.target.value)}
                  placeholder="按部件或名称搜索（如：耳仔 / 底托 / 翻盖）"
                  className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                />
                <select
                  value={tplStructFilter}
                  onChange={(e) => setTplStructFilter(e.target.value as 'all' | StructureType)}
                  className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                >
                  <option value="all">全部构造类型</option>
                  {Object.entries(STRUCTURE_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={tplMatFilter}
                  onChange={(e) => setTplMatFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                >
                  <option value="all">全部主皮料</option>
                  {MATERIAL_LIBRARY.filter(
                    (m) => m.category !== 'lining' && m.category !== 'reinforcement'
                  ).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name.split(' ')[0]}
                    </option>
                  ))}
                </select>
                <select
                  value={tplEdgeFilter}
                  onChange={(e) => setTplEdgeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                >
                  <option value="all">全部边缘工艺</option>
                  {Object.entries(EDGE_PROCESS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((tpl) => {
                  const isExp = expandedTplId === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      className="border border-[#E4E2DC] rounded-lg p-4 space-y-2.5 bg-[#FFFFFF]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-[#141413]">{tpl.name}</span>
                            {tpl.isCustom && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#FAF6F2] text-[#9A4D22] border border-[#9A4D22]/30 rounded">
                                {tpl.status === 'published' ? '自定义已发布' : tpl.status || '草稿'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#78756E] font-mono tabular-nums mt-0.5">
                            {BAG_TYPE_LABELS[tpl.bagType]?.split(' ')[0]} ·{' '}
                            {STRUCTURE_TYPE_LABELS[tpl.structureType] || tpl.structureType} ·{' '}
                            {tpl.templateVersion || 'V1.2-STD'}
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-[#16A34A] shrink-0">
                          LEVEL {tpl.reviewLevel}
                        </span>
                      </div>

                      <p className="text-xs text-[#5C5B57] leading-relaxed">{tpl.summary}</p>

                      <div className="text-[11px] font-mono tabular-nums text-[#5C5B57] bg-[#FAF9F6] border border-[#ECEAE3] rounded p-2 space-y-1">
                        <div>
                          默认尺寸：{tpl.defaultDimensions.widthMm} × {tpl.defaultDimensions.heightMm} ×{' '}
                          {tpl.defaultDimensions.depthMm} mm · 裁片 {tpl.pieceCount} 种
                        </div>
                        <div>来源：{tpl.authorizedSource}</div>
                        <div>审核：{tpl.verifiedBy}</div>
                      </div>

                      {isExp && (
                        <div className="bg-[#FAF9F6] border border-[#E4E2DC] rounded p-2.5 space-y-1.5 text-[11px]">
                          {tpl.sizeSeries && tpl.sizeSeries.length > 0 && (
                            <div>
                              <span className="font-semibold text-[#141413]">尺寸系列：</span>
                              <span className="font-mono tabular-nums text-[#5C5B57]">
                                {tpl.sizeSeries
                                  .map((s) => `${s.label}(${s.widthMm}×${s.heightMm}×${s.depthMm})`)
                                  .join(' / ')}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-[#141413]">独立裁片：</span>
                            <span className="text-[#5C5B57]">
                              {tpl.partsSpec.map((p) => `${p.partCode} ${p.name}(×${p.quantity})`).join('、')}
                            </span>
                          </div>
                          {tpl.engineeringArchive && (
                            <>
                              <div>
                                <span className="font-semibold text-[#141413]">三维结构：</span>
                                <span className="text-[#5C5B57]">
                                  {tpl.engineeringArchive.structure3DSummary}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-[#141413]">铲薄与补强：</span>
                                <span className="text-[#5C5B57]">
                                  {tpl.engineeringArchive.skivingAndReinforcementSpec}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-[#141413]">工艺与实产结果：</span>
                                <span className="text-[#166534]">
                                  {tpl.engineeringArchive.productionProcessSpec} ·{' '}
                                  {tpl.engineeringArchive.productionVerificationResult}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedTplId(isExp ? null : tpl.id)}
                          className="text-[11px] font-medium text-[#9A4D22] hover:underline whitespace-nowrap"
                        >
                          {isExp ? '收起 13 项工程档案' : '查看 13 项工程档案与尺寸系'}
                        </button>
                        {activeProject && onApplyTemplate && (
                          <button
                            type="button"
                            disabled={busyAction === `tpl_${tpl.id}`}
                            onClick={async () => {
                              setBusyAction(`tpl_${tpl.id}`);
                              try {
                                await onApplyTemplate(tpl.id, false);
                                onClose();
                              } finally {
                                setBusyAction(null);
                              }
                            }}
                            className="px-3 py-1 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] rounded whitespace-nowrap shrink-0"
                          >
                            套用到当前项目
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Professional Engineering Knowledge (LEVEL 1–5 & Versioning) */}
          {!loading && data && tab === 'knowledge' && (
            <div className="space-y-6">
              {/* Hybrid pgvector + keyword search bar */}
              <form onSubmit={handleHybridSearch} className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="测试混合向量检索（关键词 + pgvector 语义相似度），例如：植鞣皮折边防裂、拉链退让量..."
                  className="flex-1 px-3.5 py-2 text-xs bg-[#FAF9F6] border border-[#D8D5CD] rounded focus:outline-none focus:border-[#9A4D22]"
                />
                <button
                  type="submit"
                  disabled={busyAction === 'search'}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] rounded whitespace-nowrap shrink-0"
                >
                  混合检索验证
                </button>
              </form>

              {searchResults && (
                <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#141413]">
                    <span>语义 + 结构过滤检索命中结果 ({searchResults.length})</span>
                    <button
                      type="button"
                      onClick={() => setSearchResults(null)}
                      className="text-[#78756E] hover:text-[#141413]"
                    >
                      清除结果
                    </button>
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="text-xs text-[#78756E]">未命中相关知识记录。</div>
                  ) : (
                    searchResults.map((line, i) => (
                      <div key={i} className="text-xs text-[#141413] leading-relaxed">
                        • {line}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Engineering Knowledge Documents */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141413] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#9A4D22]" />
                  第四层：专业工程知识文档 ({data.knowledgeDocs.length})
                </h3>
                <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                  {data.knowledgeDocs.map((doc) => (
                    <div key={doc.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-[#141413]">
                          {doc.title}
                        </span>
                        <span
                          className={`text-xs font-medium shrink-0 ${
                            doc.reviewLevel >= 4 ? 'text-[#16A34A]' : 'text-[#D97706]'
                          }`}
                        >
                          {REVIEW_LEVEL_TEXT[doc.reviewLevel] || `LEVEL ${doc.reviewLevel}`}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C5B57] leading-relaxed">{doc.content}</p>
                      <div className="text-[11px] text-[#78756E] font-mono tabular-nums flex flex-wrap items-center gap-x-2">
                        <span>{SCOPE_TEXT[doc.securityScope] || doc.securityScope}</span>
                        <span aria-hidden="true">·</span>
                        <span>版本 {doc.version}</span>
                        <span aria-hidden="true">·</span>
                        <span>置信度 {Math.round(doc.confidence * 100)}%</span>
                        <span aria-hidden="true">·</span>
                        <span>来源: {doc.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Construction & Process Rules Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-[#E4E2DC] rounded-lg p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#141413]">
                    生产工艺规则 ({data.processRules.length})
                  </h4>
                  <div className="divide-y divide-[#ECEAE3]">
                    {data.processRules.map((pr) => (
                      <div key={pr.id} className="py-2 text-xs space-y-0.5">
                        <div className="font-medium text-[#141413]">
                          {pr.code} · {pr.name}
                        </div>
                        <div className="text-[#5C5B57] font-mono tabular-nums">
                          缝份 {pr.seamAllowanceMm}mm · 折边 {pr.foldWidthMm}mm · 铲薄目标 {pr.skiveEdgeTargetMm}mm · 针距 {pr.stitchSpacingMm}mm
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-[#E4E2DC] rounded-lg p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-[#141413]">
                    结构与接缝公差规则 ({data.constructionRules.length})
                  </h4>
                  <div className="divide-y divide-[#ECEAE3]">
                    {data.constructionRules.map((cr) => (
                      <div key={cr.id} className="py-2 text-xs space-y-0.5">
                        <div className="font-medium text-[#141413]">
                          {cr.code} · {cr.title} (公差 ±{cr.toleranceMm}mm)
                        </div>
                        <div className="text-[#5C5B57] leading-snug">{cr.ruleDetail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Knowledge Version History & Safe Rollback */}
              <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#FAF9F6] border-b border-[#E4E2DC] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#5C5B57]" />
                  <span className="text-xs font-semibold text-[#141413]">
                    专业知识版本管理与安全回滚 ({data.knowledgeVersions.length})
                  </span>
                </div>
                <div className="divide-y divide-[#ECEAE3]">
                  {data.knowledgeVersions.map((ver) => (
                    <div
                      key={ver.id}
                      className="px-4 py-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[#141413] truncate">
                          {ver.versionTag} · {ver.changeSummary}
                        </div>
                        <div className="text-[11px] text-[#78756E] font-mono tabular-nums mt-0.5">
                          审核人: {ver.reviewerName} · LEVEL {ver.reviewLevel} ·{' '}
                          {new Date(ver.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      {ver.entityId !== 'platform_baseline' && !ver.id.startsWith('kver_rb_') && (
                        <button
                          type="button"
                          onClick={() => handleRollbackVersion(ver.id)}
                          disabled={busyAction === `rb_${ver.id}`}
                          className="px-2.5 py-1 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] border border-[#D8D5CD] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                          回滚此版本
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Verified Engineering Cases & Historical Experience Records */}
          {!loading && data && tab === 'cases' && (
            <div className="space-y-6">
              {activeProject && (
                <form
                  onSubmit={handleArchiveCase}
                  className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-[#141413] flex items-center gap-1.5">
                        <Archive className="w-4 h-4 text-[#9A4D22]" />
                        归档当前项目为历史工程参考案例
                      </h3>
                      <p className="text-xs text-[#5C5B57] mt-0.5">
                        保存照片拆解、部件关系、原生纸格尺寸、几何校验及实物试制结果（案例仅供新项目参考，不直接复制投产）。
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <select
                      value={archiveScope}
                      onChange={(e) =>
                        setArchiveScope(
                          e.target.value as 'C_USER_PRIVATE' | 'A_PLATFORM_PUBLIC'
                        )
                      }
                      className="px-3 py-2 text-xs bg-white border border-[#D8D5CD] rounded"
                    >
                      <option value="C_USER_PRIVATE">C 类 · 仅个人私有隔离</option>
                      <option value="A_PLATFORM_PUBLIC">A 类 · 脱敏共享案例</option>
                    </select>
                    <input
                      type="text"
                      value={archiveNote}
                      onChange={(e) => setArchiveNote(e.target.value)}
                      placeholder="实产检验备注（如：头件裁切缝合误差 < 0.6mm，包底挺括）"
                      className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-[#D8D5CD] rounded"
                    />
                    <button
                      type="submit"
                      disabled={busyAction === 'archive_case'}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] rounded whitespace-nowrap shrink-0"
                    >
                      归档当前案例
                    </button>
                  </div>
                </form>
              )}

              {/* Verified Cases */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141413]">
                  真实工程打版案例库 ({data.patternCases.length})
                </h3>
                <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                  {data.patternCases.map((cs) => (
                    <div key={cs.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-[#141413]">
                          {cs.title}
                        </span>
                        <span
                          className={`text-xs font-medium shrink-0 ${
                            cs.productionVerified ? 'text-[#16A34A]' : 'text-[#5C5B57]'
                          }`}
                        >
                          {cs.productionVerified ? '实产验证通过 · ' : ''}
                          {REVIEW_LEVEL_TEXT[cs.reviewLevel] || `LEVEL ${cs.reviewLevel}`}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C5B57]">{cs.processSummary}</p>
                      <p className="text-xs text-[#141413]">{cs.productionResultNote}</p>
                      <div className="text-[11px] text-[#78756E] font-mono tabular-nums">
                        {SCOPE_TEXT[cs.securityScope] || cs.securityScope} · 部件数{' '}
                        {cs.structureBreakdown.length} · 版本 {cs.version}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Error & Fix Experiences */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141413]">
                  第五层：历史错题与修复经验库 ({data.experienceRecords.length})
                </h3>
                <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                  {data.experienceRecords.map((exp) => (
                    <div key={exp.id} className="p-4 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-[#141413]">
                          问题定位：{exp.errorLocation}
                        </span>
                        <span className="text-[#16A34A] font-medium shrink-0">
                          {exp.productionVerified ? '实物已验证 · ' : ''}
                          {exp.geometryPassed ? '几何校验通过' : '待验证'}
                        </span>
                      </div>
                      <div className="text-[#5C5B57]">
                        <span className="font-medium text-[#141413]">发生原因：</span>
                        {exp.rootCause}
                      </div>
                      <div className="text-[#141413]">
                        <span className="font-medium text-[#9A4D22]">修复方法：</span>
                        {exp.fixMethod}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* V1.2 Factory Production Feedback Log */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141413]">
                  工厂产线首件试制反馈归档 ({factoryFeedbacks.length})
                </h3>
                {factoryFeedbacks.length === 0 ? (
                  <div className="border border-[#E4E2DC] rounded-lg p-6 text-center text-xs text-[#78756E]">
                    暂无产线反馈记录。可在右侧「质量报告 → 专业 CAD」中提交车间试制反馈。
                  </div>
                ) : (
                  <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                    {factoryFeedbacks.map((ff) => (
                      <div key={ff.id} className="p-4 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-semibold text-[#141413]">
                            {ff.projectName} · v{ff.projectVersion}
                          </span>
                          <span
                            className={`font-medium shrink-0 ${
                              ff.conclusion === 'approved_for_mass_production'
                                ? 'text-[#16A34A]'
                                : ff.conclusion === 'rejected'
                                  ? 'text-[#DC2626]'
                                  : 'text-[#D97706]'
                            }`}
                          >
                            {ff.conclusion === 'approved_for_mass_production'
                              ? '通过 · 可投入量产'
                              : ff.conclusion === 'needs_pattern_revision'
                                ? '需局部修版'
                                : ff.conclusion === 'material_process_change'
                                  ? '需改材料/铲薄工艺'
                                  : '未通过'}
                          </span>
                        </div>
                        <div className="text-[#5C5B57] font-mono tabular-nums">
                          成包实测 {ff.finishedDimensionsMm.widthMm}×{ff.finishedDimensionsMm.heightMm}×
                          {ff.finishedDimensionsMm.depthMm}mm · 裁切误差 {ff.actualCutDeviationMm}mm · 接缝偏差{' '}
                          {ff.seamDeviationMm}mm · 外观 {ff.appearanceRating}/5 星
                        </div>
                        <div className="text-[#5C5B57]">
                          车缝与材料：{ff.stitchingCondition} · {ff.materialIssues} · {ff.skivingIssues}
                        </div>
                        {ff.patternMakerCorrections.length > 0 && (
                          <div className="text-[#9A4D22]">
                            打版修正：{ff.patternMakerCorrections.join('；')}
                          </div>
                        )}
                        <div className="text-[11px] text-[#78756E] font-mono tabular-nums">
                          记录人：{ff.recordedBy}
                          {ff.promotedToExperienceId ? ` · 已自动沉淀至 Layer 5 (${ff.promotedToExperienceId})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Blind Test & Unseen Photo Verification Log (Section 11) */}
          {!loading && data && tab === 'blind_tests' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateBlindTest}
                className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-5 space-y-3"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#141413]">
                    新增盲测验收记录（未入库真实产品照片 vs 实物成品）
                  </h3>
                  <p className="text-xs text-[#5C5B57] mt-0.5">
                    记录测试人员提供的未见产品照片、实际成品尺寸、AI 初版尺寸、人工修正内容与最终实物样品结果。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <input
                    type="text"
                    value={btTitle}
                    onChange={(e) => setBtTitle(e.target.value)}
                    placeholder="盲测包款名称，如：盲测-法棍腋下包"
                    className="sm:col-span-2 px-3 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  />
                  <select
                    value={btBagType}
                    onChange={(e) => setBtBagType(e.target.value as BagType)}
                    className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  >
                    {Object.entries(BAG_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={btTemplateId}
                    onChange={(e) => setBtTemplateId(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  >
                    {MASTER_PATTERN_LIBRARY.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <label className="text-[11px] text-[#5C5B57]">
                    实测宽(mm)
                    <input
                      type="number"
                      value={btActualW}
                      onChange={(e) => setBtActualW(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 font-mono bg-white border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="text-[11px] text-[#5C5B57]">
                    实测高(mm)
                    <input
                      type="number"
                      value={btActualH}
                      onChange={(e) => setBtActualH(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 font-mono bg-white border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="text-[11px] text-[#5C5B57]">
                    实测深(mm)
                    <input
                      type="number"
                      value={btActualD}
                      onChange={(e) => setBtActualD(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 font-mono bg-white border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="text-[11px] text-[#5C5B57]">
                    AI初版宽(mm)
                    <input
                      type="number"
                      value={btAiW}
                      onChange={(e) => setBtAiW(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 font-mono bg-white border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="text-[11px] text-[#5C5B57]">
                    AI初版高(mm)
                    <input
                      type="number"
                      value={btAiH}
                      onChange={(e) => setBtAiH(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 font-mono bg-white border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="text-[11px] text-[#5C5B57]">
                    AI初版深(mm)
                    <input
                      type="number"
                      value={btAiD}
                      onChange={(e) => setBtAiD(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 font-mono bg-white border border-[#D8D5CD] rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <select
                    value={btOutcome}
                    onChange={(e) =>
                      setBtOutcome(e.target.value as BlindTestRecord['physicalSampleOutcome'])
                    }
                    className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  >
                    <option value="passed">实物试制：一次通过</option>
                    <option value="minor_adjustment">实物试制：微调后通过</option>
                    <option value="pending">实物试制：待打样</option>
                    <option value="failed">实物试制：未通过</option>
                  </select>
                  <input
                    type="number"
                    value={btPhotoCount}
                    min={1}
                    max={8}
                    onChange={(e) => setBtPhotoCount(Number(e.target.value))}
                    placeholder="照片数"
                    className="px-2.5 py-1.5 font-mono bg-white border border-[#D8D5CD] rounded"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={btMaxSeamDiff}
                    onChange={(e) => setBtMaxSeamDiff(Number(e.target.value))}
                    placeholder="最大接缝差(mm)"
                    className="px-2.5 py-1.5 font-mono bg-white border border-[#D8D5CD] rounded"
                  />
                  <button
                    type="submit"
                    disabled={busyAction === 'create_bt' || !btTitle.trim()}
                    className="px-4 py-1.5 font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] disabled:opacity-45 rounded whitespace-nowrap shrink-0"
                  >
                    记录盲测验收
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={btCorrections}
                    onChange={(e) => setBtCorrections(e.target.value)}
                    placeholder="人工修正记录（用分号分隔）"
                    className="px-3 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  />
                  <input
                    type="text"
                    value={btNotes}
                    onChange={(e) => setBtNotes(e.target.value)}
                    placeholder="测试员与打版师评估备注"
                    className="px-3 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#141413]">
                  <span className="text-[#5C5B57] font-medium">四维独立验收证明：</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={btProofAi}
                      onChange={(e) => setBtProofAi(e.target.checked)}
                      className="accent-[#9A4D22]"
                    />
                    AI 识别通过
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={btProof2D}
                      onChange={(e) => setBtProof2D(e.target.checked)}
                      className="accent-[#9A4D22]"
                    />
                    2D 几何通过
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={btProofSeams}
                      onChange={(e) => setBtProofSeams(e.target.checked)}
                      className="accent-[#9A4D22]"
                    />
                    接缝与工艺通过
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={btProofPhysical}
                      onChange={(e) => setBtProofPhysical(e.target.checked)}
                      className="accent-[#9A4D22]"
                    />
                    实物成品打样通过
                  </label>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141413]">
                  历史盲测评估归档 ({blindTests.length})
                </h3>
                <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                  {blindTests.map((bt) => (
                    <div key={bt.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-[#141413]">{bt.title}</span>
                        <span
                          className={`font-medium shrink-0 ${
                            bt.physicalSampleOutcome === 'passed'
                              ? 'text-[#16A34A]'
                              : bt.physicalSampleOutcome === 'failed'
                                ? 'text-[#DC2626]'
                                : 'text-[#D97706]'
                          }`}
                        >
                          {bt.physicalSampleOutcome === 'passed'
                            ? '实物一次通过'
                            : bt.physicalSampleOutcome === 'minor_adjustment'
                              ? '微调后通过'
                              : bt.physicalSampleOutcome === 'failed'
                                ? '未通过'
                                : '待打样'}
                        </span>
                      </div>
                      <div className="text-[#5C5B57] font-mono tabular-nums">
                        实测 {bt.actualDimensionsMm.widthMm}×{bt.actualDimensionsMm.heightMm}×
                        {bt.actualDimensionsMm.depthMm}mm · AI初版 {bt.aiInitialDimensionsMm.widthMm}×
                        {bt.aiInitialDimensionsMm.heightMm}×{bt.aiInitialDimensionsMm.depthMm}mm · 最大轴差{' '}
                        {bt.dimensionErrorMm}mm · 最大接缝差 {bt.maxSeamDiffMm}mm
                      </div>
                      {/* 4 Strictly Separated Blind-Test Proofs */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                        {[
                          ['AI识别', bt.aiRecognitionPassed ?? true],
                          ['2D几何', bt.geometry2DPassed ?? true],
                          ['接缝工艺', bt.seamsAndProcessPassed ?? bt.processReasonable],
                          ['实物成品', bt.physicalProductionPassed ?? bt.physicalSampleOutcome === 'passed'],
                        ].map(([label, ok]) => (
                          <span
                            key={String(label)}
                            className={`px-2 py-0.5 rounded border ${
                              ok
                                ? 'bg-[#F0FDF4] border-[#16A34A]/35 text-[#166534]'
                                : 'bg-[#FEF2F2] border-[#DC2626]/35 text-[#991B1B]'
                            }`}
                          >
                            {label} {ok ? '✓' : '✗'}
                          </span>
                        ))}
                      </div>
                      {bt.manualCorrections.length > 0 && (
                        <div className="text-[#141413]">
                          人工修正：{bt.manualCorrections.join('；')}
                        </div>
                      )}
                      <div className="text-[#78756E]">{bt.testerNotes}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Continuous Learning Audit & LEVEL 1->5 Human Review Queue */}
          {!loading && data && tab === 'learning' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-[#141413]">
                    待审核新知识队列（LEVEL 1 AI 推测不得自动升级为正式工艺规则）
                  </h3>
                </div>
                {data.learningCandidates.length === 0 ? (
                  <div className="border border-[#E4E2DC] rounded-lg p-8 text-center text-xs text-[#78756E]">
                    暂无待审核的新提取经验。当您或打版师手动修改 AI 生成的纸格参数，或执行接缝修复后，系统会自动提炼候选经验至此队列。
                  </div>
                ) : (
                  <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                    {data.learningCandidates.map((cand) => (
                      <div key={cand.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-[#141413]">
                              {cand.title}
                            </div>
                            <div className="text-xs text-[#5C5B57] leading-relaxed">
                              {cand.proposedContent}
                            </div>
                            <div className="text-[11px] text-[#78756E] font-mono tabular-nums flex flex-wrap gap-x-2">
                              <span>
                                分类: {CLASSIFICATION_TEXT[cand.classification] || cand.classification}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{REVIEW_LEVEL_TEXT[cand.reviewLevel]}</span>
                              <span aria-hidden="true">·</span>
                              <span>状态: {cand.status}</span>
                              <span aria-hidden="true">·</span>
                              <span>{cand.source}</span>
                            </div>
                          </div>

                          {cand.status === 'pending' && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={busyAction === `rev_${cand.id}`}
                                onClick={() => handleReviewCandidate(cand.id, 'approve', 4)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-[#16A34A] hover:bg-[#15803D] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                              >
                                <Check className="w-3.5 h-3.5" />
                                核准升级 (LEVEL 4)
                              </button>
                              <button
                                type="button"
                                disabled={busyAction === `rev_${cand.id}`}
                                onClick={() => handleReviewCandidate(cand.id, 'approve', 5)}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] rounded whitespace-nowrap shrink-0"
                              >
                                实产验证 (LEVEL 5)
                              </button>
                              <button
                                type="button"
                                disabled={busyAction === `rev_${cand.id}`}
                                onClick={() => handleReviewCandidate(cand.id, 'reject', 1)}
                                className="px-3 py-1.5 text-xs font-medium text-[#5C5B57] bg-[#F6F5F1] hover:bg-[#ECEAE3] border border-[#D8D5CD] rounded whitespace-nowrap shrink-0"
                              >
                                驳回
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 11-point Audit Feedback Events */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141413]">
                  11 项 AI 操作与人工修正全链路审计日志 ({data.feedbackEvents.length})
                </h3>
                {data.feedbackEvents.length === 0 ? (
                  <div className="border border-[#E4E2DC] rounded-lg p-6 text-center text-xs text-[#78756E]">
                    尚无操作记录。执行 AI 对话指令或手工修改纸格后将自动记录全部 11 项反馈指标。
                  </div>
                ) : (
                  <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                    {data.feedbackEvents.map((fb) => (
                      <div key={fb.id} className="p-3.5 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-[#141413]">
                            原始指令：{fb.userOriginalPrompt}
                          </span>
                          <span className="font-mono tabular-nums text-[#78756E] shrink-0">
                            {new Date(fb.createdAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        <div className="text-[#5C5B57]">
                          解析任务：{fb.interpretedTask} · 几何变更：
                          {fb.geometryDiffSummary.join('；') || '无'}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[#78756E] flex flex-wrap gap-x-2">
                          <span>引用知识 {fb.retrievedKnowledgeIds.length} 条</span>
                          <span aria-hidden="true">·</span>
                          <span>引用案例 {fb.usedCaseIds.length} 例</span>
                          <span aria-hidden="true">·</span>
                          <span className={fb.validationPassed ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                            校验{fb.validationPassed ? '通过' : '失败'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{fb.patternMakerCorrected ? '含打版师人工修正' : 'AI 自动执行'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: V1.2 Accuracy Benchmark Suite + 10-Capability Regression Gate */}
          {!loading && data && tab === 'evaluation' && (
            <div className="space-y-6">
              {/* V1.2 Pattern Accuracy Benchmark */}
              <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#141413]">
                      V1.2 标准纸格精度基准测评（训练集 / 验证集 / 封存盲测集严格隔离）
                    </h3>
                    <p className="text-xs text-[#5C5B57] mt-1">
                      覆盖包型识别、结构分类、部件完整度、尺寸误差、接缝误差、3D重装残差及实物打样通过率等 9 项工程指标。
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction === 'benchmark'}
                    onClick={handleRunBenchmark}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] disabled:opacity-50 rounded flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    {busyAction === 'benchmark' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        测评中...
                      </>
                    ) : (
                      '重跑精度基准测评'
                    )}
                  </button>
                </div>

                {benchmarkSummary && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      {(
                        [
                          ['train', '训练集 (Train)'],
                          ['validation', '验证集 (Validation)'],
                          ['sealed_test', '封存测试集 (Sealed Test)'],
                        ] as const
                      ).map(([sp, label]) => {
                        const s = benchmarkSummary.splitsSummary[sp];
                        return (
                          <div
                            key={sp}
                            className="bg-white border border-[#E4E2DC] rounded p-3 space-y-1"
                          >
                            <div className="flex items-center justify-between font-semibold text-[#141413]">
                              <span>{label}</span>
                              <span className="font-mono text-[#16A34A]">{s.passRatePct}% 通过</span>
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-[#5C5B57]">
                              样本 {s.count} 例 · 尺寸均差 {s.avgDimErrorMm}mm · 接缝均差 {s.avgSeamDiffMm}mm
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] bg-white border border-[#E4E2DC] rounded p-3 font-mono tabular-nums">
                      <div>
                        <div className="text-[#78756E] font-sans">包型识别</div>
                        <div className="font-semibold text-[#141413]">
                          {benchmarkSummary.overallMetrics.bagTypeRecognitionPct}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[#78756E] font-sans">结构分类</div>
                        <div className="font-semibold text-[#141413]">
                          {benchmarkSummary.overallMetrics.structureAccuracyPct}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[#78756E] font-sans">尺寸/轮廓均差</div>
                        <div className="font-semibold text-[#141413]">
                          {benchmarkSummary.overallMetrics.avgDimensionErrorMm} /{' '}
                          {benchmarkSummary.overallMetrics.avgContourErrorMm}mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[#78756E] font-sans">接缝/3D重装残差</div>
                        <div className="font-semibold text-[#141413]">
                          {benchmarkSummary.overallMetrics.avgSeamMatchDiffMm} /{' '}
                          {benchmarkSummary.overallMetrics.avg3DReassemblyResidualMm}mm
                        </div>
                      </div>
                      <div>
                        <div className="text-[#78756E] font-sans">材料适配/实物通过</div>
                        <div className="font-semibold text-[#16A34A]">
                          {benchmarkSummary.overallMetrics.materialProcessFitPct}% /{' '}
                          {benchmarkSummary.overallMetrics.physicalSamplePassPct}%
                        </div>
                      </div>
                    </div>

                    <div className="border border-[#E4E2DC] bg-white rounded overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#FAF9F6] border-b border-[#E4E2DC] text-[#5C5B57]">
                          <tr>
                            <th className="py-2 px-3">划分</th>
                            <th className="py-2 px-3">测试款</th>
                            <th className="py-2 px-3 text-right">尺寸/目标</th>
                            <th className="py-2 px-3 text-right">接缝差</th>
                            <th className="py-2 px-3 text-right">3D残差</th>
                            <th className="py-2 px-3 text-right">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ECEAE3]">
                          {benchmarkSummary.cases.map((c) => (
                            <tr key={c.id}>
                              <td className="py-1.5 px-3 font-mono text-[#78756E]">{c.split}</td>
                              <td className="py-1.5 px-3 font-medium text-[#141413]">
                                {c.productTitle}
                              </td>
                              <td className="py-1.5 px-3 font-mono tabular-nums text-right">
                                {c.dimensionErrorMm} / ±{c.targetToleranceMm}mm
                              </td>
                              <td className="py-1.5 px-3 font-mono tabular-nums text-right">
                                {c.seamMatchMaxDiffMm}mm
                              </td>
                              <td className="py-1.5 px-3 font-mono tabular-nums text-right">
                                {c.assembly3DResidualMm}mm
                              </td>
                              <td
                                className={`py-1.5 px-3 font-medium text-right ${
                                  c.passedTarget ? 'text-[#16A34A]' : 'text-[#DC2626]'
                                }`}
                              >
                                {c.passedTarget ? '达标' : '超差'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#141413]">
                    AI 工程能力固定测试集与回归发布门禁（10 项能力）
                  </h3>
                  <p className="text-xs text-[#5C5B57] mt-1">
                    每次模型、知识库或工艺规则升级均须运行回归评估。若任意指标低于历史基线，系统自动阻断部署。
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyAction === 'eval'}
                  onClick={handleRunEvaluation}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] disabled:opacity-50 rounded flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {busyAction === 'eval' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      正在运行 10 项测试...
                    </>
                  ) : (
                    '运行 10 项能力回归测试'
                  )}
                </button>
              </div>

              {evalSummary && (
                <div
                  className={`border rounded-lg p-4 flex items-center justify-between gap-4 ${
                    evalSummary.allowedToDeploy
                      ? 'border-[#16A34A]/40 bg-[#F0FDF4]'
                      : 'border-[#DC2626]/40 bg-[#FEF2F2]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    {evalSummary.allowedToDeploy ? (
                      <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-[#141413]">
                        {evalSummary.allowedToDeploy
                          ? '回归门禁通过 · 允许部署新知识库/模型'
                          : '检测到能力退化 · 已禁止直接部署'}
                      </div>
                      <div className="text-[#5C5B57] font-mono tabular-nums mt-0.5">
                        运行批次 {evalSummary.runId} · 版本 {evalSummary.knowledgeVersionTag} ·
                        通过 {evalSummary.passedCount}/{evalSummary.totalTests} · 平均得分{' '}
                        {evalSummary.avgScore}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF9F6] border-b border-[#E4E2DC] text-[#5C5B57]">
                      <th className="py-2.5 px-4 font-medium">能力维度</th>
                      <th className="py-2.5 px-4 font-medium">测试用例</th>
                      <th className="py-2.5 px-4 font-medium text-right">基线分</th>
                      <th className="py-2.5 px-4 font-medium text-right">最新得分</th>
                      <th className="py-2.5 px-4 font-medium">观测结果</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECEAE3]">
                    {data.evalDatasets.map((ds) => {
                      const latest =
                        evalSummary?.results.find((r) => r.datasetId === ds.id) ??
                        data.latestEvalResults.find((r) => r.datasetId === ds.id);
                      return (
                        <tr key={ds.id} className="hover:bg-[#FAF9F6]/60">
                          <td className="py-2.5 px-4 font-mono text-[#5C5B57] whitespace-nowrap">
                            {ds.category}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-[#141413]">
                            {ds.name}
                          </td>
                          <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[#5C5B57]">
                            {ds.baselineScore.toFixed(2)}
                          </td>
                          <td
                            className={`py-2.5 px-4 font-mono tabular-nums text-right font-semibold ${
                              !latest
                                ? 'text-[#78756E]'
                                : latest.passed && !latest.regressionDetected
                                  ? 'text-[#16A34A]'
                                  : 'text-[#DC2626]'
                            }`}
                          >
                            {latest ? latest.score.toFixed(2) : '未运行'}
                          </td>
                          <td className="py-2.5 px-4 text-[#5C5B57]">
                            {latest ? latest.details.observedSummary : ds.inputPrompt}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: V1.2 Patternmaker Admin Workbench */}
          {!loading && data && tab === 'admin_workbench' && (
            <div className="space-y-6">
              <form
                onSubmit={handleCreateCustomTemplate}
                className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-5 space-y-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#141413]">
                    打版师管理工作台 · 新建 / 归档 / DXF 导入标准版型模板
                  </h3>
                  <p className="text-xs text-[#5C5B57] mt-0.5">
                    专业打版师可将已验证项目或实测 DXF 1:1 纸格导入 Master Pattern Library，设定版本号与发布状态。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(
                    [
                      ['project', '基于当前项目快照创建', !activeProject],
                      ['dxf', '粘贴 DXF 实测纸格导入', false],
                      ['scratch', '按参数结构从零创建', false],
                    ] as const
                  ).map(([mode, label, disabled]) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={disabled}
                      onClick={() => setAdmSourceMode(mode)}
                      className={`px-3 py-1.5 rounded border whitespace-nowrap ${
                        admSourceMode === mode
                          ? 'bg-[#141413] text-white border-[#141413]'
                          : 'bg-white text-[#5C5B57] border-[#D8D5CD]'
                      } disabled:opacity-40`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <input
                    type="text"
                    value={admName}
                    onChange={(e) => setAdmName(e.target.value)}
                    placeholder={
                      activeProject && admSourceMode === 'project'
                        ? `${activeProject.name} · 标准版`
                        : '模板名称（如：秋季马鞍翻盖斜挎包）'
                    }
                    className="px-3 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  />
                  <select
                    value={admBagType}
                    onChange={(e) => setAdmBagType(e.target.value as BagType)}
                    className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  >
                    {Object.entries(BAG_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={admStructType}
                    onChange={(e) => setAdmStructType(e.target.value as StructureType)}
                    className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  >
                    {Object.entries(STRUCTURE_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <input
                    type="text"
                    value={admVersion}
                    onChange={(e) => setAdmVersion(e.target.value)}
                    placeholder="模板版本号 (如 V1.0-PROD)"
                    className="px-3 py-1.5 font-mono bg-white border border-[#D8D5CD] rounded"
                  />
                  <input
                    type="text"
                    value={admVerifier}
                    onChange={(e) => setAdmVerifier(e.target.value)}
                    placeholder="审核打版师姓名"
                    className="px-3 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  />
                  <select
                    value={admStatus}
                    onChange={(e) => setAdmStatus(e.target.value as 'draft' | 'published')}
                    className="px-2.5 py-1.5 bg-white border border-[#D8D5CD] rounded"
                  >
                    <option value="published">直接发布至模板库 (Published)</option>
                    <option value="draft">保存为草稿待审核 (Draft)</option>
                  </select>
                </div>

                <input
                  type="text"
                  value={admSummary}
                  onChange={(e) => setAdmSummary(e.target.value)}
                  placeholder="工艺结构摘要（选填）"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#D8D5CD] rounded"
                />

                {admSourceMode === 'dxf' && (
                  <textarea
                    rows={4}
                    value={admDxfText}
                    onChange={(e) => setAdmDxfText(e.target.value)}
                    placeholder="粘贴标准 DXF LWPOLYLINE 文本..."
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#D8D5CD] rounded"
                  />
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busyAction === 'create_tpl'}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] disabled:opacity-50 rounded whitespace-nowrap"
                  >
                    {busyAction === 'create_tpl' ? '创建中...' : '创建并入库标准模板'}
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141413]">
                  企业 / 打版师自定义模板管理 ({customTemplates.length})
                </h3>
                {customTemplates.length === 0 ? (
                  <div className="border border-[#E4E2DC] rounded-lg p-6 text-center text-xs text-[#78756E]">
                    尚无自定义模板，可在上方基于当前项目或 DXF 一键创建。
                  </div>
                ) : (
                  <div className="divide-y divide-[#ECEAE3] border border-[#E4E2DC] rounded-lg">
                    {customTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-semibold text-[#141413] flex items-center gap-2">
                            <span>{tpl.name}</span>
                            <span className="font-mono text-[11px] text-[#9A4D22]">
                              {tpl.templateVersion || 'V1.0'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] rounded border border-[#D8D5CD] bg-[#FAF9F6]">
                              {tpl.status || 'draft'}
                            </span>
                          </div>
                          <div className="text-[#5C5B57] font-mono tabular-nums">
                            {BAG_TYPE_LABELS[tpl.bagType]?.split(' ')[0]} ·{' '}
                            {tpl.defaultDimensions.widthMm}×{tpl.defaultDimensions.heightMm}×
                            {tpl.defaultDimensions.depthMm}mm · {tpl.pieceCount} 片 · 审核：{tpl.verifiedBy}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {tpl.status !== 'published' && (
                            <button
                              type="button"
                              disabled={busyAction === `tpl_stat_${tpl.id}`}
                              onClick={() => handleToggleTemplateStatus(tpl, 'published')}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-[#16A34A] rounded"
                            >
                              审核发布
                            </button>
                          )}
                          {tpl.status !== 'archived' && (
                            <button
                              type="button"
                              disabled={busyAction === `tpl_stat_${tpl.id}`}
                              onClick={() => handleToggleTemplateStatus(tpl, 'archived')}
                              className="px-2.5 py-1 text-xs font-medium text-[#5C5B57] bg-[#F6F5F1] border border-[#D8D5CD] rounded"
                            >
                              归档下线
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 9: V1.3 Five-Engine Architecture, Industry Comparison & Authorized CAD Commands */}
          {!loading && data && tab === 'architecture' && (
            <div className="space-y-6">
              {/* Architectural Principle Banner */}
              <div className="border border-[#9A4D22]/30 bg-[#FAF6F2] rounded-lg p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#141413]">
                    RUDA 五引擎协同架构（不依赖单一通用大模型）
                  </h3>
                  {roadmap && (
                    <span className="text-[11px] font-mono tabular-nums text-[#5C5B57]">
                      存储引擎：{roadmap.telemetry.storageBackend} · 授权 CAD 指令：
                      {roadmap.telemetry.authorizedCommandCount} 组 · 模板数：
                      {roadmap.telemetry.masterTemplateCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5C5B57] leading-relaxed">
                  通用多模态大模型负责语义理解、任务规划与工具调用，不亲自手算曲线；通用视觉模型存在空间定位局限，识别框绝不直接当作生产尺寸；所有毫米级轮廓、3D-to-2D 展开、材料厚度补偿与接缝配对全部由确定性 CAD 引擎执行。
                </p>
              </div>

              {/* 5 Engines Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#141413] uppercase tracking-wide">
                  一、五引擎职责边界与现有底座
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(roadmap?.engines ?? []).map((eng) => (
                    <div
                      key={eng.id}
                      className="border border-[#E4E2DC] bg-white rounded-lg p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#141413]">{eng.name}</span>
                        <span className="font-mono text-[11px] text-[#9A4D22]">
                          ENGINE 0{eng.order}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#78756E]">
                        {eng.englishName}
                      </div>
                      <p className="text-[#141413] leading-relaxed">{eng.responsibility}</p>
                      <div className="bg-[#FFFBEB] border border-[#F59E0B]/30 rounded px-2.5 py-1.5 text-[11px] text-[#92400E]">
                        工程边界：{eng.boundaryRule}
                      </div>
                      <div className="text-[11px] text-[#5C5B57]">
                        <span className="font-medium text-[#141413]">当前模块：</span>
                        <span className="font-mono">{eng.currentModules.join(' · ')}</span>
                      </div>
                      <div className="text-[11px] text-[#166534]">
                        <span className="font-medium">演进方向：</span>
                        {eng.upgradeFocus}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Industry Benchmark Comparison Matrix */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#141413] uppercase tracking-wide">
                  二、行业标杆软件与前沿 AI 技术路线对比（VLOTHO / Romans CAD / Leonardo / ChatGarment / GarmentoPIA）
                </h4>
                <div className="space-y-3">
                  {(roadmap?.industryBenchmarks ?? []).map((prod) => (
                    <div
                      key={prod.id}
                      className="border border-[#E4E2DC] bg-white rounded-lg p-4 space-y-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#141413]">
                            {prod.name}
                          </span>
                          <span className="px-2 py-0.5 text-[11px] rounded border border-[#D8D5CD] bg-[#FAF9F6] text-[#5C5B57]">
                            {prod.category === 'commercial_cad' ? '成熟商业 CAD' : '前沿 AI 研究'}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                            prod.rudaCurrentProgress === 'implemented'
                              ? 'bg-[#F0FDF4] border-[#16A34A]/30 text-[#166534]'
                              : prod.rudaCurrentProgress === 'partial'
                                ? 'bg-[#FFFBEB] border-[#F59E0B]/30 text-[#92400E]'
                                : 'bg-[#FAF6F2] border-[#9A4D22]/30 text-[#9A4D22]'
                          }`}
                        >
                          {prod.rudaCurrentProgress === 'implemented'
                            ? 'RUDA 已融合核心链路'
                            : prod.rudaCurrentProgress === 'partial'
                              ? 'RUDA 已建立基础并持续深化'
                              : '已就绪训练集 · 规划微调'}
                        </span>
                      </div>

                      <div className="text-[#9A4D22] font-medium">
                        重点研究方向：{prod.primaryStudyFocus}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-[#FAF9F6] border border-[#ECEAE3] rounded p-3 space-y-1">
                          <div className="font-semibold text-[#141413]">核心能力</div>
                          <ul className="space-y-0.5 text-[#5C5B57] list-disc list-inside">
                            {prod.capabilities.map((cap, idx) => (
                              <li key={idx}>{cap}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-[#FAF9F6] border border-[#ECEAE3] rounded p-3 space-y-1">
                          <div className="font-semibold text-[#141413]">生产局限与工程提醒</div>
                          <p className="text-[#5C5B57] leading-relaxed">
                            {prod.productionLimitations}
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-[#ECEAE3] pt-2 text-[#141413] leading-relaxed">
                        <span className="font-semibold">RUDA 融合策略：</span>
                        {prod.rudaIntegrationStrategy}
                      </div>
                      <div className="text-[11px] text-[#5C5B57]">
                        <span className="font-medium text-[#141413]">当前落地状态：</span>
                        {prod.rudaProgressNote}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leonardo-Inspired Authorized CAD Command Registry */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-[#141413] uppercase tracking-wide">
                  三、RUDA 授权 CAD 工具指令注册表（借鉴 Leonardo：AI 负责理解与调用，CAD 负责确定性计算）
                </h4>
                <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF9F6] border-b border-[#E4E2DC] text-[#5C5B57]">
                        <th className="py-2.5 px-3 font-medium">授权 Intent</th>
                        <th className="py-2.5 px-3 font-medium">操作说明</th>
                        <th className="py-2.5 px-3 font-medium">白名单参数</th>
                        <th className="py-2.5 px-3 font-medium">确定性几何保证与回滚门禁</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ECEAE3]">
                      {(roadmap?.authorizedCadCommands ?? []).map((cmd) => (
                        <tr key={cmd.intent} className="align-top hover:bg-[#FAF9F6]/60">
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#9A4D22] whitespace-nowrap">
                            {cmd.intent}
                          </td>
                          <td className="py-2.5 px-3 text-[#141413]">{cmd.operationSummary}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#5C5B57]">
                            {cmd.allowedParameters.join(', ')}
                          </td>
                          <td className="py-2.5 px-3 text-[#5C5B57] space-y-0.5">
                            <div>{cmd.deterministicGuarantees}</div>
                            <div className="text-[11px] text-[#92400E]">
                              回滚保护：{cmd.rollbackGuard}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: V1.3 RUDA Leather Vision & Standard Pattern Training Dataset Workbench */}
          {!loading && data && tab === 'training_dataset' && (
            <div className="space-y-6">
              {/* Dataset Governance & Export Header */}
              <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#141413]">
                      RUDA 自有皮具视觉训练集 & 标准纸格训练集（打版师 + 工程师联合标注库）
                    </h3>
                    <p className="text-xs text-[#5C5B57] mt-0.5">
                      基于现有 PostgreSQL + pgvector 底座沉淀「多视角照片 + 标定尺寸 + 结构拆解 + 确认纸格」训练对，严格区别于服装数据集，为微调 RUDA 专用皮具视觉与结构模型积累数据资产。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeProject && (
                      <button
                        type="button"
                        disabled={busyAction === 'ts_extract'}
                        onClick={handleExtractTrainingFromProject}
                        className="px-3 py-1.5 text-xs font-medium text-[#141413] bg-white border border-[#D8D5CD] hover:border-[#9A4D22] rounded whitespace-nowrap"
                      >
                        {busyAction === 'ts_extract'
                          ? '提取中...'
                          : '从当前项目一键提取训练样本'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyAction === 'ts_export'}
                      onClick={handleExportTrainingJsonl}
                      className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] disabled:opacity-50 rounded whitespace-nowrap"
                    >
                      {busyAction === 'ts_export' ? '导出中...' : '导出 JSONL 微调训练集'}
                    </button>
                  </div>
                </div>

                {/* Split Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono tabular-nums">
                  <div className="bg-white border border-[#ECEAE3] rounded p-2.5">
                    <div className="text-[11px] text-[#78756E]">样本总数</div>
                    <div className="text-base font-semibold text-[#141413]">
                      {trainingSamples.length}
                    </div>
                  </div>
                  <div className="bg-white border border-[#ECEAE3] rounded p-2.5">
                    <div className="text-[11px] text-[#78756E]">训练集 (Train)</div>
                    <div className="text-base font-semibold text-[#141413]">
                      {trainingSamples.filter((s) => s.datasetSplit === 'train').length}
                    </div>
                  </div>
                  <div className="bg-white border border-[#ECEAE3] rounded p-2.5">
                    <div className="text-[11px] text-[#78756E]">验证集 (Val)</div>
                    <div className="text-base font-semibold text-[#141413]">
                      {trainingSamples.filter((s) => s.datasetSplit === 'validation').length}
                    </div>
                  </div>
                  <div className="bg-white border border-[#ECEAE3] rounded p-2.5">
                    <div className="text-[11px] text-[#78756E]">封存测试 (Sealed)</div>
                    <div className="text-base font-semibold text-[#9A4D22]">
                      {trainingSamples.filter((s) => s.datasetSplit === 'sealed_test').length}
                    </div>
                  </div>
                  <div className="bg-white border border-[#ECEAE3] rounded p-2.5">
                    <div className="text-[11px] text-[#78756E]">打版师/实产核验</div>
                    <div className="text-base font-semibold text-[#16A34A]">
                      {
                        trainingSamples.filter(
                          (s) => s.annotationStatus !== 'draft_ai' && s.leatherSpecificRulesChecked
                        ).length
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* New Annotated Sample Form */}
              <form
                onSubmit={handleCreateTrainingSample}
                className="border border-[#E4E2DC] rounded-lg p-5 space-y-4 bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-[#141413]">
                    新增皮具视觉与标准纸格标注样本
                  </h4>
                  <label className="flex items-center gap-1.5 text-xs text-[#141413] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tsLeatherChecked}
                      onChange={(e) => setTsLeatherChecked(e.target.checked)}
                      className="accent-[#9A4D22]"
                    />
                    已核验皮具专属工程规则（厚度/铲薄/回弹/五金补强，非服装规则）
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <input
                    type="text"
                    value={tsTitle}
                    onChange={(e) => setTsTitle(e.target.value)}
                    placeholder="样本名称（如：秋款盒型小牛皮手提包 6视角+卡尺）"
                    className="px-3 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded sm:col-span-2"
                  />
                  <select
                    value={tsSplit}
                    onChange={(e) => setTsSplit(e.target.value as BenchmarkSplit)}
                    className="px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  >
                    <option value="train">划分：训练集 (train)</option>
                    <option value="validation">划分：验证集 (validation)</option>
                    <option value="sealed_test">划分：封存盲测集 (sealed_test)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <select
                    value={tsBagType}
                    onChange={(e) => setTsBagType(e.target.value as BagType)}
                    className="px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  >
                    {Object.entries(BAG_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tsStructType}
                    onChange={(e) => setTsStructType(e.target.value as StructureType)}
                    className="px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  >
                    {Object.entries(STRUCTURE_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tsMaterialId}
                    onChange={(e) => setTsMaterialId(e.target.value)}
                    className="px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  >
                    {MATERIAL_LIBRARY.filter(
                      (m) => m.category !== 'lining' && m.category !== 'reinforcement'
                    ).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.thicknessMm}mm)
                      </option>
                    ))}
                  </select>
                  <select
                    value={tsEdgeProcess}
                    onChange={(e) => setTsEdgeProcess(e.target.value as EdgeProcessType)}
                    className="px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  >
                    {Object.entries(EDGE_PROCESS_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#5C5B57] font-sans">实测包宽 (mm)</span>
                    <input
                      type="number"
                      value={tsW}
                      onChange={(e) => setTsW(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#5C5B57] font-sans">实测包高 (mm)</span>
                    <input
                      type="number"
                      value={tsH}
                      onChange={(e) => setTsH(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#5C5B57] font-sans">实测包深 (mm)</span>
                    <input
                      type="number"
                      value={tsD}
                      onChange={(e) => setTsD(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-[#5C5B57] font-sans">标注打版师</span>
                    <input
                      type="text"
                      value={tsAnnotator}
                      onChange={(e) => setTsAnnotator(e.target.value)}
                      className="w-full px-2.5 py-1.5 font-sans bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <input
                    type="text"
                    value={tsVisibleParts}
                    onChange={(e) => setTsVisibleParts(e.target.value)}
                    placeholder="可见外观部件标注（逗号分隔）"
                    className="px-3 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  />
                  <input
                    type="text"
                    value={tsHiddenParts}
                    onChange={(e) => setTsHiddenParts(e.target.value)}
                    placeholder="隐藏内部部件标注（逗号分隔：里布/衬板/补强织带）"
                    className="px-3 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <input
                    type="text"
                    value={tsSeamNotes}
                    onChange={(e) => setTsSeamNotes(e.target.value)}
                    placeholder="车线边界、铲薄与对位刀口标注说明"
                    className="px-3 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  />
                  <input
                    type="text"
                    value={tsNotes}
                    onChange={(e) => setTsNotes(e.target.value)}
                    placeholder="样本工艺备注（选填）"
                    className="px-3 py-1.5 bg-[#FAF9F6] border border-[#D8D5CD] rounded"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={busyAction === 'ts_create' || !tsTitle.trim()}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] disabled:opacity-40 rounded whitespace-nowrap"
                  >
                    {busyAction === 'ts_create' ? '保存中...' : '入库训练样本 (pgvector 索引)'}
                  </button>
                </div>
              </form>

              {jsonlPreview && (
                <div className="border border-[#E4E2DC] bg-[#FAF9F6] rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#141413]">
                      JSONL 微调训练包预览（已同步下载 .jsonl 文件）
                    </span>
                    <button
                      type="button"
                      onClick={() => setJsonlPreview(null)}
                      className="text-[#5C5B57] hover:text-[#141413]"
                    >
                      收起预览
                    </button>
                  </div>
                  <pre className="max-h-40 overflow-auto text-[11px] font-mono bg-white border border-[#E4E2DC] rounded p-3 text-[#141413]">
                    {jsonlPreview}
                  </pre>
                </div>
              )}

              {/* Split Filter + Samples List */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-[#141413]">
                    已沉淀训练样本列表 ({filteredTrainingSamples.length})
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs">
                    {(
                      [
                        ['all', '全部集合'],
                        ['train', '训练集 (train)'],
                        ['validation', '验证集 (val)'],
                        ['sealed_test', '封存测试 (sealed)'],
                      ] as const
                    ).map(([sp, label]) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setTsSplitFilter(sp)}
                        className={`px-2.5 py-1 rounded border whitespace-nowrap ${
                          tsSplitFilter === sp
                            ? 'bg-[#141413] text-white border-[#141413]'
                            : 'bg-[#FAF9F6] text-[#5C5B57] border-[#D8D5CD]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredTrainingSamples.map((sample) => (
                    <div
                      key={sample.id}
                      className="border border-[#E4E2DC] bg-white rounded-lg p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#141413]">{sample.title}</span>
                          <span className="px-1.5 py-0.5 font-mono text-[10px] rounded border border-[#D8D5CD] bg-[#FAF9F6]">
                            {sample.datasetSplit}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                              sample.annotationStatus === 'production_golden'
                                ? 'bg-[#F0FDF4] border-[#16A34A]/30 text-[#166534]'
                                : sample.annotationStatus === 'patternmaker_verified'
                                  ? 'bg-[#FAF6F2] border-[#9A4D22]/30 text-[#9A4D22]'
                                  : 'bg-[#FFFBEB] border-[#F59E0B]/30 text-[#92400E]'
                            }`}
                          >
                            {sample.annotationStatus === 'production_golden'
                              ? '实产黄金样本'
                              : sample.annotationStatus === 'patternmaker_verified'
                                ? '打版师已核验'
                                : 'AI 初标草稿'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {sample.annotationStatus === 'draft_ai' && (
                            <button
                              type="button"
                              disabled={busyAction === `ts_stat_${sample.id}`}
                              onClick={() =>
                                handleUpdateTrainingStatus(sample, 'patternmaker_verified')
                              }
                              className="px-2 py-1 text-[11px] font-medium bg-[#9A4D22] text-white rounded"
                            >
                              打版师核验通过
                            </button>
                          )}
                          {sample.annotationStatus !== 'production_golden' && (
                            <button
                              type="button"
                              disabled={busyAction === `ts_stat_${sample.id}`}
                              onClick={() =>
                                handleUpdateTrainingStatus(sample, 'production_golden')
                              }
                              className="px-2 py-1 text-[11px] font-medium bg-[#16A34A] text-white rounded"
                            >
                              升级实产黄金集
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-[#5C5B57] font-mono tabular-nums">
                        {BAG_TYPE_LABELS[sample.bagType]?.split(' ')[0]} ·{' '}
                        {STRUCTURE_TYPE_LABELS[sample.structureType] || sample.structureType} ·{' '}
                        {sample.trueDimensionsMm.widthMm}×{sample.trueDimensionsMm.heightMm}×
                        {sample.trueDimensionsMm.depthMm}mm · 视角 {sample.photoCount} 张（
                        {sample.photoAngles.join('/')}）· 校准：
                        {sample.hasReferenceCalibration ? '已校准' : '未校准'} · 核验裁片：
                        {sample.verifiedPieceCount} 片
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-[#5C5B57]">
                        <div>
                          <span className="font-medium text-[#141413]">可见部件标注：</span>
                          {sample.visiblePartLabels.join('、') || '无'}
                        </div>
                        <div>
                          <span className="font-medium text-[#141413]">隐藏结构标注：</span>
                          {sample.hiddenPartLabels.join('、') || '无'}
                        </div>
                      </div>

                      <div className="text-[11px] text-[#5C5B57]">
                        <span className="font-medium text-[#141413]">接缝与工艺：</span>
                        {sample.seamBoundaryNotes} · 标注人：{sample.annotatedBy}
                        {sample.leatherSpecificRulesChecked
                          ? ' · 已核验皮具专属工程规则'
                          : ' · 待核验皮具专属规则'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
