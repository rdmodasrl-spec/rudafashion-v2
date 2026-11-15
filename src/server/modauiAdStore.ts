import { createHash, randomUUID } from 'node:crypto';
import type { AiAdProductRow } from './modauiAdBrief';
import type { AiAdConcept, AiAdCostEstimate } from './modauiAdPlanner';

/**
 * MODAUI 广告策划器 — 持久化（唯一写入路径）。
 *
 * 约束（见 docs/engineering/modules/modaui-ai-advertising.md §22.3）：
 * - 商家隔离由服务端实施：**每个**查询都带 `merchantId`，不接受客户端传入的归属。
 * - 建工程与存版本都幂等：`clientRequestId` / `contentHash` 命中即返回既有记录，不重复写入。
 * - 只记录策划与预算；生成产物将来走统一对象存储与任务队列，这里不建第二套文件库。
 * - Prisma 以最小结构类型注入，便于用纯 stub 验证查询条件（不需要真实数据库）。
 */

type JsonRecord = Record<string, unknown>;

export type AiAdPrismaLike = {
  product: { findFirst(args: any): Promise<any> };
  aiAdProject: {
    findFirst(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
  };
  aiAdConcept: { findMany(args: any): Promise<any[]>; update(args: any): Promise<any> };
  aiAdProjectVersion: {
    findFirst(args: any): Promise<any>;
    findMany(args: any): Promise<any[]>;
    create(args: any): Promise<any>;
  };
};

export type AiAdProjectRow = {
  id: string;
  merchantId: string;
  productId: string | null;
  title: string;
  status: string;
  brief: unknown;
  briefHash: string;
  selectedConceptId: string | null;
  currentVersionNo: number;
  costEstimate: unknown;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** 只读取广告需要的列：成本价、供应商等内部字段不进入策划器。 */
export async function loadAiAdProductSource(input: {
  prisma: AiAdPrismaLike;
  merchantId: string;
  productId: string;
}): Promise<AiAdProductRow | null> {
  const row = await input.prisma.product.findFirst({
    where: { id: input.productId, merchantId: input.merchantId },
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      subCategory: true,
      description: true,
      fabric: true,
      composition: true,
      origin: true,
      season: true,
      images: true,
      media: true,
      wholesalePrice: true,
      rrpPrice: true,
      variants: { select: { sku: true, color: true, size: true, isActive: true } }
    }
  });
  return (row as AiAdProductRow | null) ?? null;
}

export type AiAdConceptInput = Pick<
  AiAdConcept,
  | 'conceptKey'
  | 'route'
  | 'goal'
  | 'title'
  | 'audience'
  | 'hook'
  | 'cta'
  | 'language'
  | 'aspectRatio'
  | 'durationMs'
  | 'hashtags'
  | 'script'
  | 'storyboard'
  | 'providerStatus'
  | 'costEstimate'
>;

export function conceptCreateData(conceptId: string, concept: AiAdConceptInput): JsonRecord {
  return {
    id: conceptId,
    conceptKey: concept.conceptKey,
    route: concept.route,
    goal: concept.goal,
    title: concept.title,
    audience: concept.audience,
    hook: concept.hook,
    cta: concept.cta,
    language: concept.language,
    aspectRatio: concept.aspectRatio,
    durationMs: concept.durationMs,
    hashtags: concept.hashtags,
    script: concept.script,
    storyboard: concept.storyboard,
    providerStatus: concept.providerStatus,
    costEstimate: concept.costEstimate
  };
}

export function projectSelect() {
  return {
    id: true,
    merchantId: true,
    productId: true,
    title: true,
    status: true,
    brief: true,
    briefHash: true,
    selectedConceptId: true,
    currentVersionNo: true,
    costEstimate: true,
    supplementImages: true,
    createdBy: true,
    createdAt: true,
    updatedAt: true
  } as const;
}


/**
 * 建工程：一次嵌套写入 project + 3 个方案 + v1 版本。
 * 用预生成 id 引用方案，避免「先写方案再回填版本」的两段写入。
 */
export async function createAiAdProject(input: {
  prisma: AiAdPrismaLike;
  merchantId: string;
  actorId: string;
  productId: string;
  brief: unknown;
  briefHash: string;
  title: string;
  concepts: AiAdConceptInput[];
  selectedConceptKey: string;
  clientRequestId: string;
  costEstimate: AiAdCostEstimate | null;
  /** 商家补充的商品图片 URL（已由媒体服务上传），P1 只保存，不参与本轮文案生成。 */
  supplementImages?: readonly string[];
}): Promise<{ project: any; created: boolean }> {
  const existing = await input.prisma.aiAdProject.findFirst({
    where: { merchantId: input.merchantId, clientRequestId: input.clientRequestId },
    select: projectSelect()
  });
  if (existing) return { project: existing, created: false };

  const selected = input.concepts.find(concept => concept.conceptKey === input.selectedConceptKey);
  if (!selected) throw new Error('AI_AD_CONCEPT_INVALID');
  const conceptIds = new Map(input.concepts.map(concept => [concept.conceptKey, randomUUID()]));
  const selectedConceptId = conceptIds.get(selected.conceptKey)!;

  const project = await input.prisma.aiAdProject.create({
    data: {
      merchantId: input.merchantId,
      productId: input.productId,
      title: input.title.slice(0, 160),
      status: 'concept_selected',
      brief: input.brief,
      briefHash: input.briefHash,
      selectedConceptId,
      currentVersionNo: 1,
      costEstimate: input.costEstimate,
      supplementImages: [...(input.supplementImages ?? [])],
      createdBy: input.actorId,
      clientRequestId: input.clientRequestId,
      concepts: {
        create: input.concepts.map(concept => conceptCreateData(conceptIds.get(concept.conceptKey)!, concept))
      },
      versions: {
        create: [{
          versionNo: 1,
          // contentHash 列是 VARCHAR(64)：必须再哈希一次，不能拼接前缀（会超长）。
          contentHash: createHash('sha256').update(`v1:${input.briefHash}`).digest('hex'),
          conceptId: selectedConceptId,
          conceptKey: selected.conceptKey,
          script: selected.script,
          storyboard: selected.storyboard,
          costEstimate: selected.costEstimate,
          note: '初始方案',
          createdBy: input.actorId
        }]
      }
    },
    select: {
      ...projectSelect(),
      concepts: true,
      versions: true
    }
  });
  return { project, created: true };
}

export async function findAiAdProject(input: {
  prisma: AiAdPrismaLike;
  merchantId: string;
  projectId: string;
  includeRelations?: boolean;
}): Promise<any | null> {
  return input.prisma.aiAdProject.findFirst({
    where: { id: input.projectId, merchantId: input.merchantId },
    select: input.includeRelations
      ? {
          ...projectSelect(),
          concepts: { orderBy: { conceptKey: 'asc' } },
          versions: {
            orderBy: { versionNo: 'desc' },
            take: 20,
            select: {
              id: true,
              versionNo: true,
              conceptKey: true,
              note: true,
              createdAt: true,
              createdBy: true,
              costEstimate: true
            }
          }
        }
      : projectSelect()
  });
}

export async function listAiAdProjects(input: {
  prisma: AiAdPrismaLike;
  merchantId: string;
  take?: number;
}): Promise<AiAdProjectRow[]> {
  const take = Math.min(Math.max(input.take ?? 20, 1), 50);
  return input.prisma.aiAdProject.findMany({
    where: { merchantId: input.merchantId },
    orderBy: { updatedAt: 'desc' },
    take,
    select: projectSelect()
  });
}

export async function listAiAdProjectVersions(input: {
  prisma: AiAdPrismaLike;
  merchantId: string;
  projectId: string;
}): Promise<any[]> {
  const project = await findAiAdProject({
    prisma: input.prisma,
    merchantId: input.merchantId,
    projectId: input.projectId
  });
  if (!project) return [];
  return input.prisma.aiAdProjectVersion.findMany({
    where: { projectId: input.projectId },
    orderBy: { versionNo: 'desc' },
    take: 50,
    select: {
      id: true,
      versionNo: true,
      conceptKey: true,
      contentHash: true,
      // 版本恢复需要真实内容：只返回分镜与脚本，供前端回填后 PATCH 成新版本（不覆盖历史）。
      script: true,
      storyboard: true,
      note: true,
      createdAt: true,
      createdBy: true,
      costEstimate: true
    }
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

/**
 * 保存版本：内容哈希命中即视为同一次保存（幂等），否则分配下一个版本号。
 * 版本号并发冲突时回查哈希，仍找不到则明确报冲突，不做「重试覆盖」。
 */
export async function saveAiAdProjectVersion(input: {
  prisma: AiAdPrismaLike;
  merchantId: string;
  projectId: string;
  conceptKey: string;
  script: unknown;
  storyboard: unknown;
  contentHash: string;
  costEstimate: unknown;
  note?: string | null;
  actorId: string;
}): Promise<{ version: any; created: boolean; project: any }> {
  const project = await findAiAdProject({
    prisma: input.prisma,
    merchantId: input.merchantId,
    projectId: input.projectId,
    includeRelations: true
  });
  if (!project) throw new Error('AI_AD_PROJECT_NOT_FOUND');
  const concept = (project.concepts as Array<{ id: string; conceptKey: string }>)
    .find(candidate => candidate.conceptKey === input.conceptKey);
  if (!concept) throw new Error('AI_AD_CONCEPT_INVALID');

  const existing = await input.prisma.aiAdProjectVersion.findFirst({
    where: { projectId: input.projectId, contentHash: input.contentHash },
    select: { id: true, versionNo: true, conceptKey: true, contentHash: true, note: true, createdAt: true }
  });
  if (existing) return { version: existing, created: false, project };

  try {
    const version = await input.prisma.aiAdProjectVersion.create({
      data: {
        projectId: input.projectId,
        versionNo: project.currentVersionNo + 1,
        contentHash: input.contentHash,
        conceptId: concept.id,
        conceptKey: input.conceptKey,
        script: input.script,
        storyboard: input.storyboard,
        costEstimate: input.costEstimate,
        note: input.note ? String(input.note).slice(0, 400) : null,
        createdBy: input.actorId
      }
    });
    const updated = await input.prisma.aiAdProject.update({
      where: { id: input.projectId },
      data: {
        currentVersionNo: project.currentVersionNo + 1,
        selectedConceptId: concept.id,
        costEstimate: input.costEstimate,
        updatedAt: new Date()
      },
      select: projectSelect()
    });
    return { version, created: true, project: updated };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await input.prisma.aiAdProjectVersion.findFirst({
      where: { projectId: input.projectId, contentHash: input.contentHash },
      select: { id: true, versionNo: true, conceptKey: true, contentHash: true, note: true, createdAt: true }
    });
    if (raced) return { version: raced, created: false, project };
    throw new Error('AI_AD_VERSION_CONFLICT');
  }
}
