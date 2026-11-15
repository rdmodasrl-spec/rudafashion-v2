import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Download,
  History,
  Loader2,
  LogIn,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import { api, setAuthTokenProvider, type ProjectListItem } from './api/client';
import { AiChatPanel } from './components/AiChatPanel';
import { ExportModal } from './components/ExportModal';
import { HomeLanding } from './components/HomeLanding';
import { InspectorPanel } from './components/InspectorPanel';
import { IntelligenceDrawer } from './components/IntelligenceDrawer';
import { PatternCanvas } from './components/PatternCanvas';
import { PhotoStructureView } from './components/PhotoStructureView';
import { VersionDrawer } from './components/VersionDrawer';
import { useAuth } from './contexts/AuthContext';
import { auth } from './lib/firebase';
import { createCustomBlankPiece } from './shared/cadEngine';
import type {
  AiAnalysisJob,
  BagType,
  CaptureGuidanceProfile,
  CommandPlan,
  DesignOption,
  EdgeProcessType,
  EdgeRule,
  FactoryProductionFeedback,
  ImageAngle,
  MasterPatternTemplate,
  PatternPiece,
  Project,
  StructuredCadCommand,
} from './shared/types';

type CenterTab = 'canvas' | 'photo_structure';

export default function App() {
  const { user, idToken, loading: authLoading, authError, signInWithGoogle, signInAsDemo, signOut } = useAuth();

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [centerTab, setCenterTab] = useState<CenterTab>('canvas');

  const [activeJob, setActiveJob] = useState<AiAnalysisJob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [isPlanning, setIsPlanning] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<CommandPlan | null>(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [showIntelligenceDrawer, setShowIntelligenceDrawer] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [proMode, setProMode] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<MasterPatternTemplate[]>([]);

  // Sync in-memory Firebase ID token provider for all API requests
  useEffect(() => {
    setAuthTokenProvider(async () => {
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
      return idToken;
    });
  }, [idToken, user]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!user) return;
    setLoadingProjects(true);
    try {
      const { projects: list } = await api.listProjects();
      setProjects(list);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '加载项目列表失败');
    } finally {
      setLoadingProjects(false);
    }
  }, [user]);

  const refreshCustomTemplates = useCallback(async () => {
    if (!user) return;
    try {
      const { templates } = await api.listMasterTemplates();
      setCustomTemplates(templates.filter((t) => Boolean(t.isCustom)));
    } catch {
      // Non-fatal; built-in MASTER_PATTERN_LIBRARY remains available
    }
  }, [user]);

  useEffect(() => {
    if (user && idToken) {
      refreshProjects();
      refreshCustomTemplates();
    } else if (!user) {
      setProjects([]);
      setCustomTemplates([]);
      setActiveProject(null);
    }
  }, [user, idToken, refreshProjects, refreshCustomTemplates]);

  const pollJobUntilDone = useCallback(
    async (jobId: string, projectId: string) => {
      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise((r) => setTimeout(r, 900));
        const { job } = await api.getJob(jobId);
        setActiveJob(job);
        if (job.status === 'completed') {
          const { project } = await api.getProject(projectId);
          setActiveProject(project);
          setSelectedPieceId(project.patterns[0]?.id ?? null);
          setCenterTab('canvas');
          setActiveJob(null);
          refreshProjects();
          showToast('AI 结构拆解与二维打版已完成');
          return;
        }
        if (job.status === 'failed') {
          setErrorMsg(job.error || 'AI 分析失败');
          setActiveJob(null);
          return;
        }
      }
      setErrorMsg('AI 分析超时，请重试。');
      setActiveJob(null);
    },
    [refreshProjects, showToast]
  );

  const handleStartAiDesign = async (payload: {
    name: string;
    images: Array<{ name: string; angle: ImageAngle; dataUrl: string; mimeType: string }>;
    userBrief: string;
    captureGuidance?: Partial<CaptureGuidanceProfile>;
  }) => {
    setErrorMsg(null);
    try {
      const { project } = await api.createProject({
        name: payload.name,
        images: payload.images,
        initialPrompt: payload.userBrief,
        captureGuidance: payload.captureGuidance,
      });
      const { job } = await api.startAnalysis(
        project.id,
        payload.userBrief,
        payload.captureGuidance
      );
      setActiveJob(job);
      await pollJobUntilDone(job.id, project.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '启动 AI 设计失败');
      setActiveJob(null);
    }
  };

  const handleCreateBlankProject = async (bagType: BagType = 'tote') => {
    setErrorMsg(null);
    try {
      const { project } = await api.createProject({
        name: '手工二维纸格项目',
        bagType,
        blankMode: true,
      });
      setActiveProject(project);
      setSelectedPieceId(null);
      setCenterTab('canvas');
      refreshProjects();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '创建空白项目失败');
    }
  };

  const handleCreateFromTemplate = async (templateId: string, name?: string) => {
    setErrorMsg(null);
    try {
      const { project } = await api.createProject({
        name: name || '标准版型项目',
        templateId,
      });
      setActiveProject(project);
      setSelectedPieceId(project.patterns[0]?.id ?? null);
      setCenterTab('canvas');
      refreshProjects();
      showToast(`已从标准版型库创建：${project.name}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '从标准版型创建失败');
    }
  };

  const handleOpenProject = async (id: string) => {
    setErrorMsg(null);
    try {
      const { project } = await api.getProject(id);
      setActiveProject(project);
      setSelectedPieceId(project.patterns[0]?.id ?? null);
      setCenterTab('canvas');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '打开项目失败');
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await api.deleteProject(id);
      await refreshProjects();
      showToast('项目已删除');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleSendAiPrompt = async (prompt: string) => {
    if (!activeProject) return;
    setIsPlanning(true);
    setErrorMsg(null);
    try {
      const { plan } = await api.planAiCommand(activeProject.id, prompt);
      if (
        plan.needsConfirmation ||
        (plan.proposedOptions && plan.proposedOptions.length > 0)
      ) {
        if (plan.proposedOptions && plan.proposedOptions.length > 0) {
          const { project } = await api.executeAiCommand(activeProject.id, {
            expectedVersion: activeProject.currentVersion,
            userPrompt: prompt,
            commands: [],
            replyText: plan.replyText,
            plan,
          });
          setActiveProject(project);
        } else {
          setPendingPlan(plan);
        }
      } else {
        const res = await api.executeAiCommand(activeProject.id, {
          expectedVersion: activeProject.currentVersion,
          userPrompt: prompt,
          commands: plan.commands,
          replyText: plan.replyText,
          plan,
        });
        setActiveProject(res.project);
        if (res.rolledBack) {
          setErrorMsg(res.rollbackReason || 'CAD 几何校验异常，事务已安全回滚');
        } else {
          showToast(plan.summary || 'AI 已同步更新二维纸格');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'AI 处理指令失败');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleConfirmPlan = async (plan: CommandPlan) => {
    if (!activeProject) return;
    setIsPlanning(true);
    setErrorMsg(null);
    try {
      const res = await api.executeAiCommand(activeProject.id, {
        expectedVersion: activeProject.currentVersion,
        userPrompt: plan.userPrompt,
        commands: plan.commands,
        replyText: plan.replyText,
        plan,
      });
      setActiveProject(res.project);
      setPendingPlan(null);
      if (res.rolledBack) {
        setErrorMsg(res.rollbackReason || 'CAD 几何校验异常，事务已安全回滚');
      } else {
        showToast('已确认并执行修改');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '执行失败');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleSelectOption = async (option: DesignOption, plan: CommandPlan) => {
    if (!activeProject) return;
    setIsPlanning(true);
    setErrorMsg(null);
    try {
      const res = await api.executeAiCommand(activeProject.id, {
        expectedVersion: activeProject.currentVersion,
        userPrompt: `采用方案：${option.title}`,
        commands: option.commands,
        replyText: `已按「${option.title}」执行修改：${option.description}`,
        plan: { ...plan, summary: option.title },
      });
      setActiveProject(res.project);
      setPendingPlan(null);
      if (res.rolledBack) {
        setErrorMsg(res.rollbackReason || 'CAD 几何校验异常，事务已安全回滚');
      } else {
        showToast(`已应用方案：${option.title}`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '应用方案失败');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleUpdatePiece = async (
    updatedPiece: PatternPiece,
    commitVersionSummary?: string
  ) => {
    if (!activeProject) return;
    const nextPatterns = activeProject.patterns.map((p) =>
      p.id === updatedPiece.id ? updatedPiece : p
    );
    setActiveProject({ ...activeProject, patterns: nextPatterns });

    if (commitVersionSummary) {
      try {
        const { project } = await api.updateProject(activeProject.id, {
          expectedVersion: activeProject.currentVersion,
          patterns: nextPatterns,
          versionSummary: commitVersionSummary,
        });
        setActiveProject(project);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : '保存节点修改失败');
      }
    }
  };

  const handleSaveManual = async () => {
    if (!activeProject) return;
    setIsSaving(true);
    try {
      const { project } = await api.updateProject(activeProject.id, {
        expectedVersion: activeProject.currentVersion,
        patterns: activeProject.patterns,
        versionSummary: `手工保存样板 (v${activeProject.currentVersion + 1})`,
      });
      setActiveProject(project);
      showToast(`已保存当前项目至 v${project.currentVersion}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyParameters = async (payload: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
    handleLengthMm: number;
    bottomThicknessMm: number;
    seamAllowanceMm: number;
    materialId: string;
    edgeProcess: EdgeProcessType;
  }) => {
    if (!activeProject) return;
    try {
      const { project } = await api.updateProject(activeProject.id, {
        expectedVersion: activeProject.currentVersion,
        dimensions: {
          ...activeProject.dimensions,
          widthMm: payload.widthMm,
          heightMm: payload.heightMm,
          depthMm: payload.depthMm,
          handleLengthMm: payload.handleLengthMm,
          bottomThicknessMm: payload.bottomThicknessMm,
          seamAllowanceMm: payload.seamAllowanceMm,
          dimensionSource: 'user_confirmed',
        },
        materialId: payload.materialId,
        edgeProcess: payload.edgeProcess,
        regenerateFromParams: true,
        versionSummary: `参数面板更新 (${payload.widthMm}×${payload.heightMm}×${payload.depthMm}mm)`,
      });
      setActiveProject(project);
      showToast('参数已更新并同步重新生成所有联动纸格');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '参数更新失败');
    }
  };

  const handleCalibrateScale = async (
    axis: 'width' | 'height' | 'depth',
    actualMm: number
  ) => {
    if (!activeProject) return;
    setErrorMsg(null);
    const cmd: StructuredCadCommand = {
      intent: 'calibrate_scale',
      target: 'product',
      operation: 'proportional_calibrate',
      parameters: { referenceAxis: axis, actualMm },
    };
    try {
      const res = await api.executeAiCommand(activeProject.id, {
        expectedVersion: activeProject.currentVersion,
        commands: [cmd],
        replyText: `已按实际尺寸 ${actualMm}mm 完成整套纸格等比校准。`,
      });
      setActiveProject(res.project);
      if (res.rolledBack) {
        setErrorMsg(res.rollbackReason || '比例尺校准触发异常，已安全回滚');
      } else {
        showToast(`比例尺校准完成 (${actualMm}mm)`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '比例尺校准失败');
    }
  };

  const handleMultiAxisCalibrate = async (axes: {
    widthMm?: number;
    heightMm?: number;
    depthMm?: number;
  }) => {
    if (!activeProject) return;
    setErrorMsg(null);
    try {
      const { project, diffSummary } = await api.calibrateMultiAxis(activeProject.id, axes);
      setActiveProject(project);
      showToast(`多轴实测校准完成：${diffSummary.join('、')}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '多轴尺寸校准失败');
    }
  };

  const handleApplyTemplate = async (templateId: string, keepCustomDimensions = false) => {
    if (!activeProject) return;
    setErrorMsg(null);
    try {
      const { project, template } = await api.applyTemplate(
        activeProject.id,
        templateId,
        keepCustomDimensions
      );
      setActiveProject(project);
      setSelectedPieceId(project.patterns[0]?.id ?? null);
      showToast(`已切换结构模板：${template.name}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '切换结构模板失败');
    }
  };

  const handleUpdatePieceEdges = async (piece: PatternPiece, edges: EdgeRule[]) => {
    if (!activeProject) return;
    const updated = { ...piece, edges, manuallyEdited: true };
    const nextPatterns = activeProject.patterns.map((p) =>
      p.id === piece.id ? updated : p
    );
    const { project } = await api.updateProject(activeProject.id, {
      expectedVersion: activeProject.currentVersion,
      patterns: nextPatterns,
      versionSummary: `修改 ${piece.partCode} 边缝份规则`,
    });
    setActiveProject(project);
    showToast(`${piece.partCode} 缝份已重新计算`);
  };

  const handleAddCustomPiece = async (
    name: string,
    w: number,
    h: number,
    allowance: number
  ) => {
    if (!activeProject) return;
    const newPiece = createCustomBlankPiece(
      name,
      w,
      h,
      activeProject.materialId,
      allowance,
      activeProject.patterns.length
    );
    const nextPatterns = [...activeProject.patterns, newPiece];
    const { project } = await api.updateProject(activeProject.id, {
      expectedVersion: activeProject.currentVersion,
      patterns: nextPatterns,
      versionSummary: `手工新增纸格：${name} (${w}×${h}mm)`,
    });
    setActiveProject(project);
    setSelectedPieceId(newPiece.id);
    showToast(`已新增纸格 ${newPiece.partCode} (${w}×${h}mm)`);
  };

  const handleAutoFixIssue = async (cmd: StructuredCadCommand) => {
    if (!activeProject) return;
    const res = await api.executeAiCommand(activeProject.id, {
      expectedVersion: activeProject.currentVersion,
      commands: [cmd],
      replyText: '已执行校验自动校准，同步修正接缝长度差异。',
    });
    setActiveProject(res.project);
    if (res.rolledBack) {
      setErrorMsg(res.rollbackReason || '自动校准触发几何异常，已回滚');
    } else {
      showToast('接缝差异已自动校准');
    }
  };

  const handleApplyNesting = async () => {
    if (!activeProject) return;
    setErrorMsg(null);
    const cmd: StructuredCadCommand = {
      intent: 'apply_nesting',
      target: 'patterns',
      operation: 'smart_grain_nesting',
      parameters: { hideWidthMm: 1200, hideHeightMm: 820 },
    };
    const res = await api.executeAiCommand(activeProject.id, {
      expectedVersion: activeProject.currentVersion,
      userPrompt: '应用纹理锁定智能排料到画布',
      commands: [cmd],
      replyText: '已根据皮革背脊纹向约束与瑕疵避让区完成二维智能排料。',
    });
    setActiveProject(res.project);
    if (res.rolledBack) {
      setErrorMsg(res.rollbackReason || '排料回滚');
    } else {
      showToast('已应用纹理锁定智能排料');
    }
  };

  const handleUpdateQualitySignoff = async (payload: {
    patternMakerConfirmed?: boolean;
    patternMakerName?: string;
    physicalSamplePassed?: boolean;
    sampleLotNote?: string;
  }) => {
    if (!activeProject) return;
    setErrorMsg(null);
    try {
      const { project } = await api.updateQualitySignoff(activeProject.id, payload);
      setActiveProject(project);
      showToast('质量签核状态已更新');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '更新质量签核失败');
    }
  };

  const handleSubmitFactoryFeedback = async (payload: {
    finishedDimensionsMm: { widthMm: number; heightMm: number; depthMm: number };
    actualCutDeviationMm: number;
    seamDeviationMm: number;
    stitchingCondition: string;
    materialIssues: string;
    skivingIssues: string;
    pieceDeformation: string;
    appearanceRating: 1 | 2 | 3 | 4 | 5;
    patternMakerCorrections: string[];
    conclusion: FactoryProductionFeedback['conclusion'];
    recordedBy: string;
  }) => {
    if (!activeProject) return;
    setErrorMsg(null);
    try {
      const res = await api.submitFactoryFeedback(activeProject.id, payload);
      setActiveProject(res.project);
      showToast('已记录工厂首件试制与生产反馈，并同步沉淀至历史经验库');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '提交生产反馈失败');
    }
  };

  const handleRunValidation = async () => {
    if (!activeProject) return;
    const { project } = await api.validatePatterns(activeProject.id);
    setActiveProject(project);
    showToast(
      project.validation.passed
        ? '纸格校验通过'
        : `校验完成：发现 ${project.validation.errorCount} 个错误，${project.validation.warningCount} 个提示`
    );
  };

  const handleUndo = async () => {
    if (!activeProject || activeProject.undoStack.length === 0) return;
    const { project } = await api.undo(activeProject.id);
    setActiveProject(project);
    showToast('已撤销上一步修改');
  };

  const handleRedo = async () => {
    if (!activeProject || activeProject.redoStack.length === 0) return;
    const { project } = await api.redo(activeProject.id);
    setActiveProject(project);
    showToast('已恢复修改');
  };

  const handleRestoreVersion = async (version: number) => {
    if (!activeProject) return;
    const { project } = await api.restoreVersion(activeProject.id, version);
    setActiveProject(project);
    setShowVersionDrawer(false);
    showToast(`已恢复至历史版本 v${version}`);
  };

  const handleAddPhotos = async (
    images: Array<{ name: string; angle: ImageAngle; dataUrl: string; mimeType: string }>,
    captureGuidance?: Partial<CaptureGuidanceProfile>
  ) => {
    if (!activeProject) return;
    const { project } = await api.uploadImages(activeProject.id, images, captureGuidance);
    setActiveProject(project);
    showToast(`已补充 ${images.length} 张参考照片并同步更新采集质量检测`);
  };

  const handleImportDxf = async (dxfText: string, replaceExisting: boolean) => {
    if (!activeProject) return;
    const { verification, project } = await api.importDxf(
      activeProject.id,
      dxfText,
      replaceExisting
    );
    setActiveProject(project);
    setSelectedPieceId(project.patterns[0]?.id ?? null);
    showToast(verification.summary);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#9A4D22]" />
        <p className="text-sm text-[#5C5B57]">正在初始化 RUDA Studio 工作区...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex flex-col">
        <header className="h-14 border-b border-[#E4E2DC] bg-[#FFFFFF] px-6 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0">
            RUDA Leather Studio
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm text-[#5C5B57]">
            <span className="whitespace-nowrap shrink-0">专业皮具 CAD 打版</span>
            <span className="whitespace-nowrap shrink-0">五层工程记忆</span>
          </nav>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="px-4 py-2 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              登录工作台
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[540px] bg-[#FFFFFF] border border-[#E4E2DC] rounded-lg p-8 space-y-6">
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#9A4D22]">
                RUDA AI Leather Studio · Professional Intelligence Edition
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[#141413] text-balance">
                智能皮具结构拆解、参数化打版与工程知识系统
              </h1>
              <p className="text-sm text-[#5C5B57] leading-relaxed">
                登录后即可访问您个人隔离的皮具项目库、材料偏好与五层长期记忆。每一次结构设计与人工修正都将安全沉淀，经专业审核后持续提升打版准确度。
              </p>
            </div>

            <div className="border-t border-[#ECEAE3] pt-5 space-y-2 text-xs text-[#5C5B57]">
              <div>• 项目长期记忆：完整保留原图、部件关系、参数与全版本几何历史</div>
              <div>• 工程知识库：区分 AI 推测 (LEVEL 1) 与实产验证 (LEVEL 5)</div>
              <div>• 知识产权隔离：个人设计数据严格按账户独立隔离保存</div>
            </div>

            {authError && (
              <div className="px-3.5 py-2.5 text-xs bg-[#FEF2F2] border border-[#DC2626]/30 text-[#991B1B] rounded">
                {authError}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] rounded-md transition-colors flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                使用 Google 账号登录工作台
              </button>
              <button
                type="button"
                onClick={() => void signInAsDemo()}
                className="w-full py-2 px-4 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] border border-[#D9D5CC] rounded-md transition-colors flex items-center justify-center gap-2"
              >
                以本地演示模式进入工作台（免 Google 登录）
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <>
        <HomeLanding
          projects={projects}
          loadingProjects={loadingProjects}
          activeJob={activeJob}
          errorMsg={errorMsg}
          onStartAiDesign={handleStartAiDesign}
          onCreateBlankProject={handleCreateBlankProject}
          onCreateFromTemplate={handleCreateFromTemplate}
          onOpenProject={handleOpenProject}
          onDeleteProject={handleDeleteProject}
          onOpenIntelligence={() => setShowIntelligenceDrawer(true)}
          userEmail={user.email}
          onSignOut={signOut}
        />
        {showIntelligenceDrawer && (
          <IntelligenceDrawer
            activeProject={null}
            onClose={() => setShowIntelligenceDrawer(false)}
            onNotify={showToast}
            onTemplatesChanged={() => void refreshCustomTemplates()}
          />
        )}
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F6F5F1] text-[#141413] overflow-hidden">
      {/* Top Bar Contract: 3 zones */}
      <header className="h-14 shrink-0 bg-[#FFFFFF] border-b border-[#E4E2DC] px-5 flex items-center justify-between gap-8">
        <span className="font-display text-base font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0">
          RUDA Leather Studio
        </span>

        <nav className="flex items-center gap-6 text-xs font-medium text-[#5C5B57]">
          <button
            type="button"
            onClick={() => {
              setActiveProject(null);
              refreshProjects();
            }}
            className="hover:text-[#141413] transition-colors whitespace-nowrap shrink-0"
          >
            工作室首页
          </button>
          <button
            type="button"
            onClick={() => setCenterTab('canvas')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              centerTab === 'canvas'
                ? 'text-[#9A4D22] border-b-2 border-[#9A4D22]'
                : 'hover:text-[#141413]'
            }`}
          >
            二维纸格画布
          </button>
          <button
            type="button"
            onClick={() => setCenterTab('photo_structure')}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              centerTab === 'photo_structure'
                ? 'text-[#9A4D22] border-b-2 border-[#9A4D22]'
                : 'hover:text-[#141413]'
            }`}
          >
            照片与结构关系
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-[#9A4D22] hover:bg-[#823F1A] rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            导出生产文件
          </button>
        </div>
      </header>

      {/* Main 3-Column Studio Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <AiChatPanel
          project={activeProject}
          isPlanning={isPlanning}
          pendingPlan={pendingPlan}
          onSendPrompt={handleSendAiPrompt}
          onConfirmPlan={handleConfirmPlan}
          onSelectOption={handleSelectOption}
          onCancelPlan={() => setPendingPlan(null)}
        />

        {centerTab === 'canvas' ? (
          <PatternCanvas
            patterns={activeProject.patterns}
            selectedPieceId={selectedPieceId}
            proMode={proMode}
            onSelectPiece={setSelectedPieceId}
            onUpdatePiece={handleUpdatePiece}
          />
        ) : (
          <PhotoStructureView
            project={activeProject}
            onSelectPiece={(pid) => {
              setSelectedPieceId(pid);
              setCenterTab('canvas');
            }}
            onAddPhotos={handleAddPhotos}
          />
        )}

        <InspectorPanel
          project={activeProject}
          selectedPieceId={selectedPieceId}
          proMode={proMode}
          customTemplates={customTemplates}
          onToggleProMode={setProMode}
          onSelectPiece={(id) => {
            setSelectedPieceId(id);
            setCenterTab('canvas');
          }}
          onApplyParameters={handleApplyParameters}
          onCalibrateScale={handleCalibrateScale}
          onMultiAxisCalibrate={handleMultiAxisCalibrate}
          onApplyTemplate={handleApplyTemplate}
          onUpdatePieceEdges={handleUpdatePieceEdges}
          onAddCustomPiece={handleAddCustomPiece}
          onAutoFixIssue={handleAutoFixIssue}
          onRunValidation={handleRunValidation}
          onApplyNesting={handleApplyNesting}
          onUpdateQualitySignoff={handleUpdateQualitySignoff}
          onSubmitFactoryFeedback={handleSubmitFactoryFeedback}
        />
      </div>

      {/* Bottom Bar: Save, Undo, Redo, Versions, Intelligence */}
      <footer className="h-12 shrink-0 bg-[#FFFFFF] border-t border-[#E4E2DC] px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#5C5B57] min-w-0">
          <span className="font-medium text-[#141413] truncate">{activeProject.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums shrink-0">
            v{activeProject.currentVersion}
          </span>
          {toastMsg && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#16A34A] font-medium truncate">{toastMsg}</span>
            </>
          )}
          {errorMsg && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#DC2626] font-medium truncate">{errorMsg}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowIntelligenceDrawer(true)}
            className="px-3 py-1.5 text-xs font-medium text-[#9A4D22] bg-[#FAF6F2] hover:bg-[#F3ECE4] border border-[#9A4D22]/30 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            知识与记忆
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={activeProject.undoStack.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] disabled:opacity-40 border border-[#D8D5CD] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Undo2 className="w-3.5 h-3.5" />
            撤销
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={activeProject.redoStack.length === 0}
            className="px-3 py-1.5 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] disabled:opacity-40 border border-[#D8D5CD] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Redo2 className="w-3.5 h-3.5" />
            恢复
          </button>
          <button
            type="button"
            onClick={() => setShowVersionDrawer(true)}
            className="px-3 py-1.5 text-xs font-medium text-[#141413] bg-[#F6F5F1] hover:bg-[#ECEAE3] border border-[#D8D5CD] rounded flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            版本历史 ({activeProject.versions.length})
          </button>
          <button
            type="button"
            onClick={handleSaveManual}
            disabled={isSaving}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#141413] hover:bg-[#2C2C2A] disabled:opacity-50 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            保存版本
          </button>
        </div>
      </footer>

      {showExportModal && (
        <ExportModal
          project={activeProject}
          onClose={() => setShowExportModal(false)}
          onRecordExport={async (fmt, pageFmt) => {
            const { project } = await api.recordExport(activeProject.id, fmt, pageFmt);
            setActiveProject(project);
          }}
          onImportDxf={handleImportDxf}
        />
      )}

      {showVersionDrawer && (
        <VersionDrawer
          project={activeProject}
          onClose={() => setShowVersionDrawer(false)}
          onRestoreVersion={handleRestoreVersion}
        />
      )}

      {showIntelligenceDrawer && (
        <IntelligenceDrawer
          activeProject={activeProject}
          onClose={() => setShowIntelligenceDrawer(false)}
          onNotify={showToast}
          onApplyTemplate={handleApplyTemplate}
          onTemplatesChanged={() => void refreshCustomTemplates()}
        />
      )}
    </div>
  );
}
