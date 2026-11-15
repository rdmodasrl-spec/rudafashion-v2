import fs from 'node:fs';
import path from 'node:path';
import { createStarterSnapshot } from '../src/shared/cadEngine';
import type { AiAnalysisJob, Project } from '../src/shared/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ruda-studio.json');

interface DatabaseState {
  projects: Project[];
  jobs: AiAnalysisJob[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createInitialSeedProjects(): Project[] {
  const now = new Date().toISOString();
  const snap = createStarterSnapshot('tote');
  snap.dimensions.widthMm = 300;
  snap.dimensions.heightMm = 240;
  snap.dimensions.depthMm = 120;
  snap.dimensions.dimensionSource = 'user_confirmed';

  const sampleTotePath = '/src/assets/images/sample_tote_bag_1794583671666.jpg';
  const seedProject: Project = {
    id: 'proj_demo_tote',
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

  return [seedProject];
}

let state: DatabaseState = { projects: [], jobs: [] };

export function loadDatabase(): DatabaseState {
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (Array.isArray(parsed.projects)) {
        state = {
          projects: parsed.projects,
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        };
        return state;
      }
    } catch {
      // Fall through to seed
    }
  }
  state = {
    projects: createInitialSeedProjects(),
    jobs: [],
  };
  saveDatabase();
  return state;
}

export function saveDatabase() {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function listProjects(): Project[] {
  if (state.projects.length === 0) loadDatabase();
  return state.projects;
}

export function getProjectById(id: string): Project | undefined {
  if (state.projects.length === 0) loadDatabase();
  return state.projects.find((p) => p.id === id);
}

export function upsertProject(project: Project): Project {
  if (state.projects.length === 0) loadDatabase();
  const idx = state.projects.findIndex((p) => p.id === project.id);
  project.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    state.projects[idx] = project;
  } else {
    state.projects.unshift(project);
  }
  saveDatabase();
  return project;
}

export function deleteProjectById(id: string): boolean {
  const before = state.projects.length;
  state.projects = state.projects.filter((p) => p.id !== id);
  if (state.projects.length !== before) {
    saveDatabase();
    return true;
  }
  return false;
}

export function upsertJob(job: AiAnalysisJob): AiAnalysisJob {
  const idx = state.jobs.findIndex((j) => j.id === job.id);
  job.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    state.jobs[idx] = job;
  } else {
    state.jobs.unshift(job);
  }
  if (state.jobs.length > 50) {
    state.jobs.length = 50;
  }
  saveDatabase();
  return job;
}

export function getJobById(id: string): AiAnalysisJob | undefined {
  return state.jobs.find((j) => j.id === id);
}
