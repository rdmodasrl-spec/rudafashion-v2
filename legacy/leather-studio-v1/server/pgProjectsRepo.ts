import fs from 'node:fs';
import path from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { db, isPostgresConfigured } from '../src/db/index.ts';
import { rudaProjects } from '../src/db/schema.ts';
import { createStarterSnapshot } from '../src/shared/cadEngine.ts';
import type { Project } from '../src/shared/types.ts';

const FALLBACK_DIR = path.resolve(process.cwd(), 'data');
const FALLBACK_PROJECTS_FILE = path.join(FALLBACK_DIR, 'ruda-projects-fallback.json');

interface FallbackUserStore {
  projects: Record<string, Record<string, { project: Project; sessionContext: Record<string, unknown> }>>;
}

let fallbackCache: FallbackUserStore | null = null;

function loadFallbackStore(): FallbackUserStore {
  if (fallbackCache) return fallbackCache;
  try {
    if (fs.existsSync(FALLBACK_PROJECTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FALLBACK_PROJECTS_FILE, 'utf-8')) as FallbackUserStore;
      if (parsed && typeof parsed.projects === 'object') {
        fallbackCache = parsed;
        return fallbackCache;
      }
    }
  } catch {
    // ignore corrupt fallback file
  }
  fallbackCache = { projects: {} };
  return fallbackCache;
}

function saveFallbackStore(store: FallbackUserStore) {
  try {
    if (!fs.existsSync(FALLBACK_DIR)) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_PROJECTS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Warning: could not persist fallback projects file:', err);
  }
}

function buildSeedProjectForUser(ownerUid: string): Project {
  const now = new Date().toISOString();
  const snap = createStarterSnapshot('tote');
  snap.dimensions.widthMm = 300;
  snap.dimensions.heightMm = 240;
  snap.dimensions.depthMm = 120;
  snap.dimensions.dimensionSource = 'user_confirmed';

  const sampleTotePath = '/src/assets/images/sample_tote_bag_1794583671666.jpg';
  return {
    id: `proj_demo_tote_${ownerUid.slice(0, 8)}`,
    name: '经典植鞣托特包（示例样板）',
    createdAt: now,
    updatedAt: now,
    currentVersion: 1,
    undoStack: [],
    redoStack: [],
    images: [
      {
        id: 'img_seed_tote',
        name: 'tote_front_studio.jpg',
        angle: 'front',
        dataUrl: sampleTotePath,
        mimeType: 'image/jpeg',
        uploadedAt: now,
      },
    ],
    visionSummary: {
      detectedBagType: 'tote',
      confidence: 0.95,
      visualNotes:
        '识别为经典立体植鞣牛皮托特包：矩形主包身、双条顶部手拎提手配水滴形耳仔底座铆钉加固、直筒侧围结构、包口磁扣开合。',
      observedFeatures: ['正面主包身', '水滴形提手连接底座', '双面撞钉', '包口明线走线', '包口磁扣'],
      uncertainStructures: ['内部内衬与贴袋结构（正面照片不可见，已按工艺库推断标注）', '包底加固皮糠纸厚度'],
      analyzedAt: now,
    },
    ...snap,
    messages: [
      {
        id: 'msg_seed_1',
        role: 'assistant',
        content:
          '已完成示例托特包结构拆解与二维打版（当前尺寸 300 × 240 × 120 mm）。你可以直接在下方输入自然语言指令，例如「把包宽增加 2 厘米」「加一个内部拉链袋」或「侧面改成圆弧」。',
        timestamp: now,
      },
    ],
    commandLog: [],
    versions: [
      {
        version: 1,
        timestamp: now,
        summary: '初始建版：300 × 240 × 120 mm 植鞣牛皮托特包',
        author: 'ai',
        snapshot: structuredClone(snap),
      },
    ],
    exports: [],
  };
}

export async function listProjectsForUser(ownerUid: string): Promise<Project[]> {
  if (!isPostgresConfigured) {
    const store = loadFallbackStore();
    if (!store.projects[ownerUid]) {
      store.projects[ownerUid] = {};
    }
    const entries = Object.values(store.projects[ownerUid]);
    if (entries.length === 0) {
      const starter = buildSeedProjectForUser(ownerUid);
      store.projects[ownerUid][starter.id] = {
        project: starter,
        sessionContext: { updatedAt: starter.updatedAt },
      };
      saveFallbackStore(store);
      return [starter];
    }
    return entries
      .map((e) => e.project)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  try {
    const rows = await db
      .select()
      .from(rudaProjects)
      .where(eq(rudaProjects.ownerUid, ownerUid))
      .orderBy(desc(rudaProjects.updatedAt));

    if (rows.length === 0) {
      const starter = buildSeedProjectForUser(ownerUid);
      await upsertProjectForUser(ownerUid, starter);
      return [starter];
    }

    return rows.map((r) => r.projectDataJson as Project);
  } catch (error) {
    console.error('Database query failed in listProjectsForUser:', error);
    throw new Error('加载项目列表失败，请稍后重试。', { cause: error });
  }
}

export async function getProjectForUser(
  projectId: string,
  ownerUid: string
): Promise<Project | null> {
  if (!isPostgresConfigured) {
    const store = loadFallbackStore();
    return store.projects[ownerUid]?.[projectId]?.project ?? null;
  }

  try {
    const rows = await db
      .select()
      .from(rudaProjects)
      .where(and(eq(rudaProjects.id, projectId), eq(rudaProjects.ownerUid, ownerUid)))
      .limit(1);

    if (!rows[0]) return null;
    return rows[0].projectDataJson as Project;
  } catch (error) {
    console.error('Database query failed in getProjectForUser:', error);
    throw new Error('读取项目详情失败。', { cause: error });
  }
}

export async function upsertProjectForUser(
  ownerUid: string,
  project: Project,
  sessionUpdate?: {
    activeTask?: string;
    lastIntent?: string;
    retrievedMemoryIds?: string[];
  }
): Promise<Project> {
  if (!isPostgresConfigured) {
    const store = loadFallbackStore();
    if (!store.projects[ownerUid]) {
      store.projects[ownerUid] = {};
    }
    project.updatedAt = new Date().toISOString();
    const prevSession = store.projects[ownerUid][project.id]?.sessionContext ?? {};
    store.projects[ownerUid][project.id] = {
      project,
      sessionContext: {
        ...prevSession,
        ...(sessionUpdate ?? {}),
        updatedAt: project.updatedAt,
      },
    };
    saveFallbackStore(store);
    return project;
  }

  try {
    project.updatedAt = new Date().toISOString();
    const thumbnailUrl = project.images[0]?.dataUrl ?? null;

    const existing = await db
      .select({ sessionContextJson: rudaProjects.sessionContextJson })
      .from(rudaProjects)
      .where(and(eq(rudaProjects.id, project.id), eq(rudaProjects.ownerUid, ownerUid)))
      .limit(1);

    const nextSession = {
      ...(existing[0]?.sessionContextJson ?? {}),
      ...(sessionUpdate ?? {}),
      updatedAt: project.updatedAt,
    };

    await db
      .insert(rudaProjects)
      .values({
        id: project.id,
        ownerUid,
        securityScope: 'C_USER_PRIVATE',
        name: project.name,
        bagType: project.bagType,
        currentVersion: project.currentVersion,
        validationPassed: project.validation.passed,
        thumbnailUrl,
        sessionContextJson: nextSession,
        projectDataJson: project,
        createdAt: new Date(project.createdAt || project.updatedAt),
        updatedAt: new Date(project.updatedAt),
      })
      .onConflictDoUpdate({
        target: rudaProjects.id,
        set: {
          name: project.name,
          bagType: project.bagType,
          currentVersion: project.currentVersion,
          validationPassed: project.validation.passed,
          thumbnailUrl,
          sessionContextJson: nextSession,
          projectDataJson: project,
          updatedAt: new Date(project.updatedAt),
        },
      });

    return project;
  } catch (error) {
    console.error('Database query failed in upsertProjectForUser:', error);
    throw new Error('保存项目到 PostgreSQL 失败。', { cause: error });
  }
}

export async function getProjectSessionContext(projectId: string, ownerUid: string) {
  if (!isPostgresConfigured) {
    const store = loadFallbackStore();
    return store.projects[ownerUid]?.[projectId]?.sessionContext ?? {};
  }

  try {
    const rows = await db
      .select({ sessionContextJson: rudaProjects.sessionContextJson })
      .from(rudaProjects)
      .where(and(eq(rudaProjects.id, projectId), eq(rudaProjects.ownerUid, ownerUid)))
      .limit(1);
    return rows[0]?.sessionContextJson ?? {};
  } catch (error) {
    console.error('Database query failed in getProjectSessionContext:', error);
    throw new Error('读取会话上下文失败。', { cause: error });
  }
}

export async function deleteProjectForUser(
  projectId: string,
  ownerUid: string
): Promise<boolean> {
  if (!isPostgresConfigured) {
    const store = loadFallbackStore();
    if (store.projects[ownerUid]?.[projectId]) {
      delete store.projects[ownerUid][projectId];
      saveFallbackStore(store);
      return true;
    }
    return false;
  }

  try {
    const deleted = await db
      .delete(rudaProjects)
      .where(and(eq(rudaProjects.id, projectId), eq(rudaProjects.ownerUid, ownerUid)))
      .returning({ id: rudaProjects.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteProjectForUser:', error);
    throw new Error('删除项目失败。', { cause: error });
  }
}
