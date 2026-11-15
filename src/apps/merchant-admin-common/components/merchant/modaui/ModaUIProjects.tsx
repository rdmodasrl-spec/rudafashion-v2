import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUpRight, Download, Loader2, Plus, RefreshCw, Save, Upload, X } from 'lucide-react';

import { apiGet, apiPost, apiPut, ApiError } from '../../../../../api/client';

const projectsPath = '/api/merchant/studio-projects';
const projectPayloadVersion = 1;

type StudioProject = {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
};

type StudioProjectDetail = StudioProject & {
  payload: unknown;
};

type ProjectListResponse = {
  projects: StudioProject[];
  nextCursor: string | null;
};

type ProjectResponse = {
  project: StudioProjectDetail;
};

type StudioFile = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
};

type StudioJob = {
  jobId: string;
  status: string;
  errorCode: string | null;
  attempts: number;
  retryCount: number;
  traceId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

type StudioJobDetail = {
  runtimeStatus: string;
  summary: string | null;
  approvalId: string | null;
  errors: string[];
};

type SavedDesign = {
  id: string;
  title: string;
  category: string;
};

type LinkedDesign = {
  designId: string;
  title: string;
  category: string;
};

type ModaUIProjectsProps = {
  isIt: boolean;
  industryTemplateId?: string | null;
  initialBrief: string;
  initialCapability: string | null;
  onOpenProject?: (brief: string, capability: string | null, projectId: string) => void;
  onClose: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readProjectPayload(value: unknown): { brief: string; capability: string | null } {
  if (!isRecord(value) || value.schemaVersion !== projectPayloadVersion) {
    return { brief: '', capability: null };
  }
  return {
    brief: typeof value.brief === 'string' ? value.brief : '',
    capability: typeof value.capability === 'string' ? value.capability : null
  };
}

function readProjectFileIds(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.fileIds)) return [];
  return value.fileIds.filter((fileId): fileId is string => typeof fileId === 'string');
}

function normalizeStudioJobDetail(value: unknown): StudioJobDetail {
  const record = isRecord(value) ? value : {};
  return {
    runtimeStatus: typeof record.runtimeStatus === 'string' ? record.runtimeStatus : 'unknown',
    summary: typeof record.summary === 'string' ? record.summary : null,
    approvalId: typeof record.approvalId === 'string' ? record.approvalId : null,
    errors: Array.isArray(record.errors) ? record.errors.filter((item): item is string => typeof item === 'string') : []
  };
}

function readLinkedDesigns(value: unknown): LinkedDesign[] {
  if (!isRecord(value) || !Array.isArray(value.linkedDesigns)) return [];
  return value.linkedDesigns.filter((item): item is LinkedDesign =>
    isRecord(item)
    && typeof item.designId === 'string'
    && typeof item.title === 'string'
    && typeof item.category === 'string'
  );
}

function makeRequestKey(prefix = 'apparel-project'): string {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${suffix}`;
}

function getProjectErrorMessage(error: unknown, fallback: string, isIt: boolean): string {
  if (error instanceof ApiError && error.code === 'STUDIO_PROJECT_MIGRATION_REQUIRED') {
    return isIt
      ? 'L’archiviazione dei progetti Studio richiede una migrazione del database. Riprova dopo la distribuzione della migrazione.'
      : 'Studio 项目数据库迁移尚未部署，当前无法读取或保存项目。迁移完成后请重试。';
  }
  return error instanceof Error ? error.message : fallback;
}

function getStudioFileErrorMessage(error: unknown, fallback: string, isIt: boolean): string {
  if (error instanceof ApiError && error.code === 'OBJECT_STORAGE_NOT_CONFIGURED') {
    return isIt
      ? 'L’archiviazione privata dei file Studio non è configurata; il caricamento non è disponibile.'
      : 'Studio 私有文件存储尚未配置，无法上传；文件不会降级到公开店铺存储。';
  }
  return getProjectErrorMessage(error, fallback, isIt);
}

function getStudioJobStatus(status: string, isIt: boolean): string {
  const labels: Record<string, [string, string]> = {
    queued: ['排队中', 'In coda'],
    planning: ['规划中', 'Pianificazione'],
    running: ['执行中', 'In esecuzione'],
    waiting_approval: ['等待确认', 'In attesa di approvazione'],
    verifying: ['校验中', 'Verifica'],
    retrying: ['重试中', 'Nuovo tentativo'],
    completed: ['已完成', 'Completato'],
    failed: ['失败', 'Non riuscito'],
    dead_letter: ['需要处理', 'Richiede intervento'],
    cancelled: ['已取消', 'Annullato']
  };
  const label = labels[status];
  return label ? label[isIt ? 1 : 0] : status;
}

function formatStudioFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.ceil(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStudioFileContentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
    dxf: 'application/dxf',
    glb: 'model/gltf-binary'
  };
  return extension ? contentTypes[extension] || '' : '';
}

export const ModaUIProjects: React.FC<ModaUIProjectsProps> = ({
  isIt,
  industryTemplateId,
  initialBrief,
  initialCapability,
  onOpenProject,
  onClose
}) => {
  const isLeatherStudio = industryTemplateId === 'bags_wholesale';
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState(initialBrief);
  const [selectedProject, setSelectedProject] = useState<StudioProjectDetail | null>(null);
  const [revisionConflict, setRevisionConflict] = useState(false);
  const [linkedFileIds, setLinkedFileIds] = useState<string[]>([]);
  const [files, setFiles] = useState<StudioFile[]>([]);
  const [filesNextCursor, setFilesNextCursor] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [retryUploadAvailable, setRetryUploadAvailable] = useState(false);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [jobsNextCursor, setJobsNextCursor] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [jobDetail, setJobDetail] = useState<{ jobId: string; detail: StudioJobDetail } | null>(null);
  const [jobDetailLoadingId, setJobDetailLoadingId] = useState<string | null>(null);
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [designsError, setDesignsError] = useState('');
  const [designsLoading, setDesignsLoading] = useState(true);
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [linkedDesigns, setLinkedDesigns] = useState<LinkedDesign[]>([]);
  const pendingCreateRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingFileUploadRef = useRef<{ file: File; key: string } | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const jobDetailRequestIdRef = useRef(0);

  const copy = useCallback((zh: string, it: string) => isIt ? it : zh, [isIt]);

  const loadProjects = useCallback(async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (industryTemplateId) query.set('industryTemplate', industryTemplateId);
      if (cursor) query.set('cursor', cursor);
      const result = await apiGet<ProjectListResponse>(`${projectsPath}?${query.toString()}`);
      setProjects(current => append ? [...current, ...result.projects] : result.projects);
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      setError(getProjectErrorMessage(loadError, copy('项目加载失败，请重试。', 'Impossibile caricare i progetti. Riprova.'), isIt));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [copy, industryTemplateId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const loadDesigns = useCallback(async () => {
    setDesignsLoading(true);
    setDesignsError('');
    try {
      const result = await apiGet<{ designs: SavedDesign[] }>('/api/merchant/modagpt/designs?category=all');
      setDesigns(result.designs);
    } catch (loadError) {
      setDesignsError(getProjectErrorMessage(loadError, copy('作品库加载失败，请重试。', 'Impossibile caricare i design. Riprova.'), isIt));
    } finally {
      setDesignsLoading(false);
    }
  }, [copy, isIt]);

  useEffect(() => {
    if (isLeatherStudio) return;
    void loadDesigns();
  }, [isLeatherStudio, loadDesigns]);

  const loadProjectFiles = useCallback(async (projectId: string, cursor?: string, append = false) => {
    setFilesLoading(true);
    setFilesError('');
    try {
      const query = new URLSearchParams({ limit: '100' });
      if (cursor) query.set('cursor', cursor);
      const result = await apiGet<{ files: StudioFile[]; nextCursor: string | null }>(
        `${projectsPath}/${encodeURIComponent(projectId)}/files?${query.toString()}`
      );
      if (activeProjectIdRef.current !== projectId) return;
      setFiles(current => append ? [...current, ...result.files] : result.files);
      setFilesNextCursor(result.nextCursor);
    } catch (loadError) {
      if (activeProjectIdRef.current !== projectId) return;
      setFilesError(getStudioFileErrorMessage(loadError, copy('文件读取失败，请重试。', 'Impossibile caricare i file. Riprova.'), isIt));
    } finally {
      if (activeProjectIdRef.current === projectId) setFilesLoading(false);
    }
  }, [copy, isIt]);

  const loadProjectJobs = useCallback(async (projectId: string, cursor?: string, append = false) => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (cursor) query.set('cursor', cursor);
      const result = await apiGet<{ jobs: StudioJob[]; nextCursor: string | null }>(
        `${projectsPath}/${encodeURIComponent(projectId)}/jobs?${query.toString()}`
      );
      if (activeProjectIdRef.current !== projectId) return;
      setJobs(current => append ? [...current, ...result.jobs] : result.jobs);
      setJobsNextCursor(result.nextCursor);
    } catch (loadError) {
      if (activeProjectIdRef.current !== projectId) return;
      setJobsError(getProjectErrorMessage(loadError, copy('任务读取失败，请重试。', 'Impossibile caricare le attività. Riprova.'), isIt));
    } finally {
      if (activeProjectIdRef.current === projectId) setJobsLoading(false);
    }
  }, [copy, isIt]);

  const loadStudioJobDetail = async (jobId: string) => {
    if (jobDetailLoadingId === jobId) return;
    if (jobDetail?.jobId === jobId) {
      setJobDetail(null);
      return;
    }
    const requestId = ++jobDetailRequestIdRef.current;
    const projectId = activeProjectIdRef.current;
    setJobDetailLoadingId(jobId);
    setJobsError('');
    try {
      const result = await apiGet<unknown>(`/api/merchant/modagpt/task/${encodeURIComponent(jobId)}`);
      if (requestId !== jobDetailRequestIdRef.current || projectId !== activeProjectIdRef.current) return;
      setJobDetail({ jobId, detail: normalizeStudioJobDetail(result) });
    } catch (loadError) {
      if (requestId !== jobDetailRequestIdRef.current || projectId !== activeProjectIdRef.current) return;
      setJobsError(getProjectErrorMessage(loadError, copy('任务详情读取失败，请重试。', 'Impossibile caricare i dettagli dell’attività. Riprova.'), isIt));
    } finally {
      if (requestId === jobDetailRequestIdRef.current) setJobDetailLoadingId(null);
    }
  };

  const beginNewProject = () => {
    activeProjectIdRef.current = null;
    jobDetailRequestIdRef.current += 1;
    setSelectedProject(null);
    setTitle(isLeatherStudio ? copy('未命名皮具项目', 'Nuovo progetto pelletteria') : copy('未命名服装项目', 'Nuovo progetto moda'));
    setBrief(initialBrief);
    setLinkedDesigns([]);
    setLinkedFileIds([]);
    setFiles([]);
    setFilesNextCursor(null);
    setJobs([]);
    setJobsNextCursor(null);
    setJobDetail(null);
    setJobDetailLoadingId(null);
    setFilesError('');
    setJobsError('');
    setSelectedDesignId('');
    setRevisionConflict(false);
    setError('');
    setNotice('');
  };

  const openProject = async (projectId: string) => {
    activeProjectIdRef.current = projectId;
    jobDetailRequestIdRef.current += 1;
    setOpeningId(projectId);
    setError('');
    setNotice('');
    setFiles([]);
    setFilesNextCursor(null);
    setJobs([]);
    setJobsNextCursor(null);
    setJobDetail(null);
    setFilesError('');
    setJobsError('');
    try {
      const query = industryTemplateId ? `?industryTemplate=${encodeURIComponent(industryTemplateId)}` : '';
      const result = await apiGet<ProjectResponse>(`${projectsPath}/${encodeURIComponent(projectId)}${query}`);
      const payload = readProjectPayload(result.project.payload);
      setSelectedProject(result.project);
      setTitle(result.project.title);
      setBrief(payload.brief);
      setLinkedDesigns(readLinkedDesigns(result.project.payload));
      setLinkedFileIds(readProjectFileIds(result.project.payload));
      setSelectedDesignId('');
      setRevisionConflict(false);
      void loadProjectFiles(result.project.id);
      void loadProjectJobs(result.project.id);
    } catch (openError) {
      activeProjectIdRef.current = selectedProject?.id ?? null;
      setError(getProjectErrorMessage(openError, copy('项目打开失败，请重试。', 'Impossibile aprire il progetto. Riprova.'), isIt));
    } finally {
      setOpeningId(null);
    }
  };

  const loadLatestRevision = async () => {
    if (!selectedProject) return;
    activeProjectIdRef.current = selectedProject.id;
    setOpeningId(selectedProject.id);
    setError('');
    try {
      const query = industryTemplateId ? `?industryTemplate=${encodeURIComponent(industryTemplateId)}` : '';
      const result = await apiGet<ProjectResponse>(`${projectsPath}/${encodeURIComponent(selectedProject.id)}${query}`);
      const payload = readProjectPayload(result.project.payload);
      setSelectedProject(result.project);
      setTitle(result.project.title);
      setBrief(payload.brief);
      setLinkedDesigns(readLinkedDesigns(result.project.payload));
      setLinkedFileIds(readProjectFileIds(result.project.payload));
      setSelectedDesignId('');
      setRevisionConflict(false);
      void loadProjectFiles(result.project.id);
      void loadProjectJobs(result.project.id);
      setNotice(copy('已载入服务器最新版本。', 'È stata caricata la versione più recente.'));
    } catch (loadError) {
      setError(getProjectErrorMessage(loadError, copy('最新版本加载失败，请重试。', 'Impossibile caricare l’ultima versione. Riprova.'), isIt));
    } finally {
      setOpeningId(null);
    }
  };

  const addLinkedDesign = () => {
    const design = designs.find(item => item.id === selectedDesignId);
    if (!design) return;
    if (linkedDesigns.some(item => item.designId === design.id)) {
      setNotice(copy('该作品已关联到项目。', 'Questo design è già collegato al progetto.'));
      return;
    }
    if (linkedDesigns.length >= 50) {
      setError(copy('每个项目最多关联 50 个作品。', 'Puoi collegare al massimo 50 design.'));
      return;
    }
    setLinkedDesigns(current => [...current, {
      designId: design.id,
      title: design.title,
      category: design.category
    }]);
    setNotice(copy('作品已加入待保存内容；保存新版本后将在其他商家端同步。', 'Design aggiunto; salva una nuova versione per sincronizzarlo sugli altri dispositivi.'));
  };

  const removeLinkedDesign = (designId: string) => {
    setLinkedDesigns(current => current.filter(item => item.designId !== designId));
  };

  const toggleLinkedFile = (fileId: string) => {
    if (linkedFileIds.includes(fileId)) {
      setLinkedFileIds(linkedFileIds.filter(id => id !== fileId));
      return;
    }
    if (linkedFileIds.length >= 100) {
      setFilesError(copy('每个项目版本最多关联 100 个文件。', 'Ogni versione del progetto può collegare al massimo 100 file.'));
      return;
    }
    setFilesError('');
    setLinkedFileIds([...linkedFileIds, fileId]);
  };

  const transferPendingFile = async () => {
    const pending = pendingFileUploadRef.current;
    if (!selectedProject || !pending || uploadingFile) return;
    setUploadingFile(true);
    setFilesError('');
    setNotice('');
    try {
      const contentType = getStudioFileContentType(pending.file);
      const initialized = await apiPost<{
        file: StudioFile;
        uploadUrl: string | null;
      }>(
        `${projectsPath}/${encodeURIComponent(selectedProject.id)}/files`,
        {
          fileName: pending.file.name,
          contentType,
          sizeBytes: pending.file.size
        },
        undefined,
        { 'Idempotency-Key': pending.key }
      );
      if (initialized.file.status !== 'ready') {
        if (!initialized.uploadUrl) {
          throw new Error(copy('上传地址已失效，请重新选择文件后重试。', 'URL di caricamento non disponibile. Seleziona di nuovo il file.'));
        }
        const response = await fetch(initialized.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'private,no-store'
          },
          body: pending.file
        });
        if (!response.ok) {
          throw new Error(copy(`文件上传失败（${response.status}）。`, `Caricamento non riuscito (${response.status}).`));
        }
        await apiPost(`/api/merchant/studio-files/${encodeURIComponent(initialized.file.id)}/complete`, {});
      }
      pendingFileUploadRef.current = null;
      setRetryUploadAvailable(false);
      setLinkedFileIds(current => current.includes(initialized.file.id) ? current : [...current, initialized.file.id]);
      setNotice(copy('文件已私有保存；保存新版本后才会写入项目版本。', 'File salvato in privato; salva una nuova versione per collegarlo al progetto.'));
      await loadProjectFiles(selectedProject.id);
    } catch (uploadError) {
      setRetryUploadAvailable(true);
      setFilesError(getStudioFileErrorMessage(
        uploadError,
        copy('文件上传失败；可重试当前文件。', 'Caricamento non riuscito; puoi riprovare con il file selezionato.'),
        isIt
      ));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileSelection = (file: File | undefined) => {
    if (!file || !selectedProject || uploadingFile) return;
    if (linkedFileIds.length >= 100) {
      setFilesError(copy('每个项目版本最多关联 100 个文件，请先移除一个引用。', 'Ogni versione può collegare al massimo 100 file. Rimuovi prima un riferimento.'));
      return;
    }
    const contentType = getStudioFileContentType(file);
    if (!contentType) {
      setFilesError(copy('文件类型不受支持，请选择 JPG、PNG、WebP、PDF、DXF 或 GLB。', 'Tipo non supportato. Scegli JPG, PNG, WebP, PDF, DXF o GLB.'));
      return;
    }
    pendingFileUploadRef.current = { file, key: makeRequestKey('studio-file') };
    setRetryUploadAvailable(false);
    void transferPendingFile();
  };

  const discardPendingFile = () => {
    pendingFileUploadRef.current = null;
    setRetryUploadAvailable(false);
    setFilesError('');
  };

  const downloadStudioFile = async (fileId: string) => {
    setFilesError('');
    try {
      const result = await apiGet<{ url: string }>(
        `/api/merchant/studio-files/${encodeURIComponent(fileId)}/download`
      );
      const anchor = document.createElement('a');
      anchor.href = result.url;
      anchor.rel = 'noreferrer';
      anchor.download = '';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (downloadError) {
      setFilesError(getStudioFileErrorMessage(downloadError, copy('文件下载失败，请重试。', 'Impossibile scaricare il file. Riprova.'), isIt));
    }
  };

  const saveProject = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setError(copy('请填写项目名称。', 'Inserisci il nome del progetto.'));
      return;
    }
    if (revisionConflict) {
      setError(copy('项目已存在新版本，请先载入最新版本再保存。', 'Esiste una versione più recente. Caricala prima di salvare.'));
      return;
    }
    const storedPayload = selectedProject && isRecord(selectedProject.payload)
      ? selectedProject.payload
      : {};
    const payload = {
      ...storedPayload,
      schemaVersion: projectPayloadVersion,
      brief,
      capability: selectedProject ? readProjectPayload(selectedProject.payload).capability : initialCapability,
      linkedDesigns,
      fileIds: linkedFileIds
    };
    setSaving(true);
    setError('');
    setNotice('');
    try {
      let result: ProjectResponse;
      if (selectedProject) {
        result = await apiPut<ProjectResponse>(`${projectsPath}/${encodeURIComponent(selectedProject.id)}`, {
          title: normalizedTitle,
          payload,
          expectedRevision: selectedProject.revision,
          ...(industryTemplateId ? { industryTemplate: industryTemplateId } : {})
        });
      } else {
        const fingerprint = JSON.stringify({ title: normalizedTitle, payload });
        if (pendingCreateRef.current?.fingerprint !== fingerprint) {
          pendingCreateRef.current = { fingerprint, key: makeRequestKey() };
        }
        result = await apiPost<ProjectResponse>(
          projectsPath,
          {
            title: normalizedTitle,
            payload,
            ...(industryTemplateId ? { industryTemplate: industryTemplateId } : {})
          },
          undefined,
          { 'Idempotency-Key': pendingCreateRef.current.key }
        );
        pendingCreateRef.current = null;
      }
      activeProjectIdRef.current = result.project.id;
      setSelectedProject(result.project);
      setTitle(result.project.title);
      setProjects(current => [
        { id: result.project.id, title: result.project.title, revision: result.project.revision, updatedAt: result.project.updatedAt },
        ...current.filter(project => project.id !== result.project.id)
      ]);
      setNotice(copy('项目已保存，可在其他商家端继续打开。', 'Progetto salvato e disponibile sugli altri dispositivi.'));
      setRevisionConflict(false);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.status === 409 && selectedProject) {
        setRevisionConflict(true);
        setError(copy('项目已在其他设备更新。当前内容未覆盖服务器版本；请载入最新版本后继续。', 'Il progetto è stato aggiornato su un altro dispositivo. Le modifiche non hanno sovrascritto la versione salvata; carica l’ultima versione per continuare.'));
      } else {
        setError(getProjectErrorMessage(saveError, copy('项目保存失败，请检查网络后重试。', 'Impossibile salvare il progetto. Controlla la rete e riprova.'), isIt));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-neutral-950/30"
      role="presentation"
      onMouseDown={event => {
        if (!uploadingFile && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="flex h-full w-full max-w-xl flex-col border-l border-neutral-200 bg-neutral-50 text-neutral-900 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modaui-projects-title"
      >
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 px-4">
          <div className="min-w-0">
            <h2 id="modaui-projects-title" className="truncate text-base font-semibold">
              {isLeatherStudio ? copy('皮具项目', 'Progetti pelletteria') : copy('服装项目', 'Progetti moda')}
            </h2>
            <p className="text-xs text-neutral-600">
              {onOpenProject
                ? copy('项目、私有文件和任务状态由服务端统一保存。', 'Progetti, file privati e attività sono salvati sul server condiviso.')
                : copy('项目与私有文件由服务端统一保存；皮具专属 AI 执行入口尚未接通。', 'Progetti e file privati sono condivisi; il flusso AI dedicato alla pelletteria non è ancora disponibile.')}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={uploadingFile} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-ruda-control)] text-neutral-700 hover:bg-neutral-100 disabled:opacity-50" aria-label={copy('关闭项目', 'Chiudi progetti')}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(9rem,0.8fr)_minmax(0,1.2fr)] md:grid-rows-1 md:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)]">
          <section className="flex min-h-0 flex-col border-b border-neutral-200 md:border-b-0 md:border-r" aria-label={copy('项目列表', 'Elenco progetti')}>
            <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2">
              <span className="text-sm font-medium">{copy('项目列表', 'Progetti')}</span>
              <button
                type="button"
                onClick={beginNewProject}
                disabled={uploadingFile}
                className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-ruda-control)] bg-neutral-900 px-2.5 text-xs font-semibold text-white hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4" />
                {copy('新建', 'Nuovo')}
              </button>
            </div>
            <div className="min-h-24 flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center gap-2 px-2 py-4 text-sm text-neutral-600"><Loader2 className="h-4 w-4 animate-spin" />{copy('正在读取项目…', 'Caricamento progetti…')}</div>
              ) : projects.length === 0 ? (
                <p className="px-2 py-4 text-sm leading-5 text-neutral-600">{copy('还没有项目。新建项目后，设计简报可在电脑、手机 Web 和小程序继续查看。', 'Nessun progetto. Crea un progetto per continuare il brief su desktop, mobile e mini-programma.')}</p>
              ) : (
                <ul className="space-y-1">
                  {projects.map(project => (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => void openProject(project.id)}
                        disabled={Boolean(openingId) || uploadingFile}
                        className={`flex w-full items-start justify-between gap-2 rounded-[var(--radius-ruda-control)] border px-2.5 py-2 text-left disabled:opacity-60 ${selectedProject?.id === project.id ? 'border-neutral-900 bg-neutral-100' : 'border-transparent hover:bg-neutral-100'}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{project.title}</span>
                          <span className="mt-1 block text-xs text-neutral-600">{copy('版本', 'Rev.')} {project.revision}</span>
                        </span>
                        {openingId === project.id ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {error && !selectedProject && (
                <div role="alert" className="mt-2 flex items-start gap-2 rounded-[var(--radius-ruda-card)] border border-neutral-200 bg-white p-2 text-sm leading-5">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700" />
                  <span>{error}</span>
                  <button type="button" onClick={() => void loadProjects()} className="ml-auto shrink-0 underline underline-offset-2">{copy('重试', 'Riprova')}</button>
                </div>
              )}
              {nextCursor && (
                <button type="button" onClick={() => void loadProjects(nextCursor, true)} disabled={loadingMore} className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-200 text-sm font-medium hover:bg-white disabled:opacity-60">
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDown className="h-4 w-4" />}
                  {copy('加载更多', 'Carica altri')}
                </button>
              )}
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-y-auto p-4" aria-label={copy('项目详情', 'Dettagli progetto')}>
            <label className="mb-1.5 text-sm font-medium" htmlFor="modaui-project-title">{copy('项目名称', 'Nome progetto')}</label>
            <input
              id="modaui-project-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              maxLength={160}
              placeholder={copy('例如：春季衬衫系列', 'Es. Collezione camicie primavera')}
              className="mb-4 min-h-10 rounded-[var(--radius-ruda-input)] border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-neutral-700 focus:ring-2 focus:ring-neutral-300"
            />
            <label className="mb-1.5 text-sm font-medium" htmlFor="modaui-project-brief">{copy('设计简报', 'Brief di design')}</label>
            <textarea
              id="modaui-project-brief"
              value={brief}
              onChange={event => setBrief(event.target.value)}
              rows={7}
              maxLength={10000}
              placeholder={copy('记录款式方向、面料、版型或待确认事项。', 'Descrivi stile, tessuti, vestibilità o dettagli da confermare.')}
              className="min-h-36 resize-y rounded-[var(--radius-ruda-input)] border border-neutral-300 bg-white p-3 text-sm leading-5 outline-none focus:border-neutral-700 focus:ring-2 focus:ring-neutral-300"
            />
            {!isLeatherStudio && <div className="mt-5">
              <h3 className="text-sm font-semibold">{copy('关联作品', 'Design collegati')}</h3>
              <p className="mt-1 text-xs leading-4 text-neutral-600">{copy('从当前商家作品库选择；作品由服务端验证归属，保存项目新版本后同步到其他端。', 'Scegli dalla libreria del merchant; la proprietà viene verificata dal server e sincronizzata salvando una nuova versione.')}</p>
              {designsLoading ? (
                <p className="mt-2 text-sm text-neutral-600">{copy('正在读取作品库…', 'Caricamento design…')}</p>
              ) : designsError ? (
                <div role="alert" className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
                  <span>{designsError}</span>
                  <button type="button" onClick={() => void loadDesigns()} className="shrink-0 underline underline-offset-2">{copy('重试', 'Riprova')}</button>
                </div>
              ) : designs.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-600">{copy('作品库暂无可关联作品。', 'Nessun design disponibile nella libreria.')}</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor="modaui-project-design">{copy('选择作品', 'Seleziona un design')}</label>
                  <select
                    id="modaui-project-design"
                    value={selectedDesignId}
                    onChange={event => setSelectedDesignId(event.target.value)}
                    className="min-h-10 min-w-0 flex-1 rounded-[var(--radius-ruda-input)] border border-neutral-300 bg-white px-3 text-sm"
                  >
                    <option value="">{copy('选择作品', 'Seleziona un design')}</option>
                    {designs.map(design => (
                      <option key={design.id} value={design.id}>{design.title}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={addLinkedDesign}
                    disabled={!selectedDesignId || linkedDesigns.length >= 50}
                    className="min-h-10 rounded-[var(--radius-ruda-control)] border border-neutral-300 bg-white px-3 text-sm font-semibold hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copy('添加到项目', 'Aggiungi')}
                  </button>
                </div>
              )}
              {linkedDesigns.length > 0 && (
                <ul className="mt-3 space-y-2" aria-label={copy('已关联作品', 'Design collegati')}>
                  {linkedDesigns.map(design => (
                    <li key={design.designId} className="flex items-center justify-between gap-3 rounded-[var(--radius-ruda-control)] border border-neutral-200 bg-white px-3 py-2">
                      <span className="min-w-0 truncate text-sm">{design.title}</span>
                      <button
                        type="button"
                        onClick={() => removeLinkedDesign(design.designId)}
                        className="min-h-9 shrink-0 px-2 text-xs font-medium text-neutral-700 underline underline-offset-2"
                        aria-label={copy(`解除关联：${design.title}`, `Rimuovi collegamento: ${design.title}`)}
                      >
                        {copy('解除关联', 'Rimuovi')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>}
            <section className="mt-5 border-t border-neutral-200 pt-4" aria-labelledby="modaui-project-files-title">
              <div className="flex items-center justify-between gap-3">
                <h3 id="modaui-project-files-title" className="text-sm font-semibold">{copy('项目文件', 'File progetto')}</h3>
                {selectedProject && (
                  <button
                    type="button"
                    onClick={() => void loadProjectFiles(selectedProject.id)}
                    disabled={filesLoading || uploadingFile}
                    className="inline-flex min-h-9 items-center gap-1 px-2 text-sm font-medium underline underline-offset-2 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${filesLoading ? 'animate-spin' : ''}`} />
                    {copy('刷新', 'Aggiorna')}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs leading-4 text-neutral-600">
                {copy('支持图片、PDF、DXF 和 GLB。上传后保存新版本，文件引用才会进入项目快照。', 'Immagini, PDF, DXF e GLB. Salva una nuova versione dopo il caricamento per includere i riferimenti.')}
              </p>
              {selectedProject ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-300 bg-white px-3 text-sm font-semibold hover:bg-neutral-100">
                    <Upload className="h-4 w-4" />
                    {uploadingFile ? copy('上传中…', 'Caricamento…') : copy('选择并上传文件', 'Scegli e carica')}
                    <input
                      type="file"
                      className="sr-only"
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.dxf,.glb,image/jpeg,image/png,image/webp,application/pdf,application/dxf,model/gltf-binary"
                      disabled={uploadingFile || retryUploadAvailable}
                      onChange={event => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        handleFileSelection(file);
                      }}
                    />
                  </label>
                  {retryUploadAvailable && (
                    <>
                      <button
                        type="button"
                        onClick={() => void transferPendingFile()}
                        disabled={uploadingFile}
                        className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-300 bg-white px-3 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-60"
                      >
                        <RefreshCw className={`h-4 w-4 ${uploadingFile ? 'animate-spin' : ''}`} />
                        {copy('重试当前文件', 'Riprova il file')}
                      </button>
                      <button
                        type="button"
                        onClick={discardPendingFile}
                        disabled={uploadingFile}
                        className="min-h-10 px-2 text-sm font-medium underline underline-offset-2 disabled:opacity-60"
                      >
                        {copy('放弃并重选', 'Scegli un altro file')}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-neutral-600">{copy('先创建或打开项目，再上传文件。', 'Crea o apri un progetto prima di caricare file.')}</p>
              )}
              {filesError && <p role="alert" className="mt-2 text-sm leading-5 text-neutral-800">{filesError}</p>}
              {filesLoading ? (
                <p role="status" className="mt-2 text-sm text-neutral-600">{copy('正在读取项目文件…', 'Caricamento file…')}</p>
              ) : files.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-600">{copy('项目还没有可用文件。', 'Nessun file disponibile.')}</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-2" aria-label={copy('项目文件列表', 'Elenco file progetto')}>
                    {files.map(file => {
                      const linked = linkedFileIds.includes(file.id);
                      return (
                        <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{file.fileName}</span>
                            <span className="block text-xs text-neutral-600">
                              {formatStudioFileSize(file.sizeBytes)} · {linked ? copy('关联到新版本', 'Collegato alla nuova versione') : copy('未关联', 'Non collegato')}
                            </span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleLinkedFile(file.id)}
                              disabled={saving || revisionConflict || uploadingFile}
                              className="min-h-9 px-2 text-sm font-medium underline underline-offset-2 disabled:opacity-60"
                            >
                              {linked ? copy('移除引用', 'Rimuovi') : copy('关联', 'Collega')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void downloadStudioFile(file.id)}
                              className="inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-ruda-control)] border border-neutral-300 bg-white px-2 text-sm font-medium hover:bg-neutral-100"
                              aria-label={copy(`下载 ${file.fileName}`, `Scarica ${file.fileName}`)}
                            >
                              <Download className="h-4 w-4" />
                              {copy('下载', 'Scarica')}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {filesNextCursor && selectedProject && (
                    <button
                      type="button"
                      onClick={() => void loadProjectFiles(selectedProject.id, filesNextCursor, true)}
                      disabled={filesLoading}
                      className="mt-2 min-h-9 px-2 text-sm font-medium underline underline-offset-2 disabled:opacity-60"
                    >
                      {copy('加载更多文件', 'Carica altri file')}
                    </button>
                  )}
                </>
              )}
            </section>
            <section className="mt-5 border-t border-neutral-200 pt-4" aria-labelledby="modaui-project-jobs-title">
              <div className="flex items-center justify-between gap-3">
                <h3 id="modaui-project-jobs-title" className="text-sm font-semibold">{copy('AI 任务', 'Attività AI')}</h3>
                {selectedProject && (
                  <button
                    type="button"
                    onClick={() => void loadProjectJobs(selectedProject.id)}
                    disabled={jobsLoading}
                    className="inline-flex min-h-9 items-center gap-1 px-2 text-sm font-medium underline underline-offset-2 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${jobsLoading ? 'animate-spin' : ''}`} />
                    {copy('刷新', 'Aggiorna')}
                  </button>
                )}
              </div>
              {jobsError && <p role="alert" className="mt-2 text-sm leading-5 text-neutral-800">{jobsError}</p>}
              {jobsLoading ? (
                <p role="status" className="mt-2 text-sm text-neutral-600">{copy('正在读取任务…', 'Caricamento attività…')}</p>
              ) : jobs.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-600">{copy('项目还没有关联的 AI 任务。', 'Nessuna attività AI collegata al progetto.')}</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-2" aria-label={copy('项目 AI 任务列表', 'Elenco attività AI')}>
                    {jobs.map(job => (
                      <li key={job.jobId} className="border-b border-neutral-200 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium">{job.jobId}</span>
                          <span className="text-neutral-700">{getStudioJobStatus(job.status, isIt)}</span>
                          <button
                            type="button"
                            onClick={() => void loadStudioJobDetail(job.jobId)}
                            disabled={jobDetailLoadingId === job.jobId}
                            aria-expanded={jobDetail?.jobId === job.jobId}
                            className="inline-flex min-h-9 items-center gap-1 px-2 font-medium underline underline-offset-2 disabled:opacity-60"
                          >
                            {jobDetailLoadingId === job.jobId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {jobDetail?.jobId === job.jobId ? copy('收起详情', 'Nascondi dettagli') : copy('查看详情', 'Dettagli')}
                          </button>
                        </div>
                        {job.errorCode && <p className="mt-1 text-xs text-neutral-600">{job.errorCode}</p>}
                        {jobDetail?.jobId === job.jobId && (
                          <div className="mt-2 space-y-1 text-sm leading-5 text-neutral-700" role="status">
                            <p>{copy('任务运行状态', 'Stato attività')}: {getStudioJobStatus(jobDetail.detail.runtimeStatus, isIt)}</p>
                            {jobDetail.detail.summary && <p>{jobDetail.detail.summary}</p>}
                            {jobDetail.detail.approvalId && <p>{copy('待审批编号', 'ID approvazione')}: {jobDetail.detail.approvalId}</p>}
                            {jobDetail.detail.errors.map((message, index) => <p key={`${job.jobId}-error-${index}`}>{message}</p>)}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {jobsNextCursor && selectedProject && (
                    <button
                      type="button"
                      onClick={() => void loadProjectJobs(selectedProject.id, jobsNextCursor, true)}
                      disabled={jobsLoading}
                      className="mt-2 min-h-9 px-2 text-sm font-medium underline underline-offset-2 disabled:opacity-60"
                    >
                      {copy('加载更多任务', 'Carica altre attività')}
                    </button>
                  )}
                </>
              )}
            </section>
            <p className="mt-3 text-xs leading-4 text-neutral-600">{copy('文件传输依赖已配置的私有对象存储。网络中断后可在本页重试当前文件；关闭页面后需重新选择文件。', 'Il trasferimento richiede uno storage privato configurato. Dopo un’interruzione puoi riprovare qui; se chiudi la pagina dovrai selezionare di nuovo il file.')}</p>
            {selectedProject && <p className="mt-2 text-xs text-neutral-600">{copy('当前版本', 'Versione corrente')} {selectedProject.revision}</p>}
            {(selectedProject || !error) && (error || notice) && (
              <div role={error ? 'alert' : 'status'} className={`mt-3 rounded-[var(--radius-ruda-card)] border p-2.5 text-sm leading-5 ${error ? 'border-neutral-300 bg-white text-neutral-800' : 'border-neutral-200 bg-neutral-100 text-neutral-800'}`}>
                {error || notice}
                {revisionConflict && (
                  <button type="button" onClick={() => void loadLatestRevision()} disabled={Boolean(openingId)} className="mt-2 inline-flex min-h-9 items-center gap-2 font-semibold underline underline-offset-2 disabled:opacity-60">
                    <RefreshCw className={`h-4 w-4 ${openingId ? 'animate-spin' : ''}`} />
                    {copy('载入服务器最新版本', 'Carica ultima versione')}
                  </button>
                )}
              </div>
            )}
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              {selectedProject && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenProject(brief, readProjectPayload(selectedProject.payload).capability, selectedProject.id);
                    onClose();
                  }}
                  className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] border border-neutral-300 bg-white px-3 text-sm font-semibold hover:bg-neutral-100"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {copy('打开到工作台', 'Apri nel workspace')}
                </button>
              )}
              <button
                type="button"
                onClick={() => void saveProject()}
                disabled={saving || revisionConflict || uploadingFile}
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-ruda-control)] bg-neutral-900 px-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? copy('保存中…', 'Salvataggio…') : selectedProject ? copy('保存新版本', 'Salva nuova versione') : copy('创建项目', 'Crea progetto')}
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};
