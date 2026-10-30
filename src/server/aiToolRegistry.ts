import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { isAppStoreNativeRuntimeCompatible } from './appStoreValidation';
import {
  isAiToolsManifestEnabled,
  parseAiToolManifest,
  planAppToolGrants,
  readManifestTrialDays,
  resolveAiToolAccess,
  type AiToolAccess,
  type AiToolAppState,
  type AiToolManifest,
  type AiToolManifestIssue
} from './aiToolManifest';

/**
 * Manifest → 数据库投影与商家级授权。
 * 纯解析逻辑在 `aiToolManifest.ts`；本文件只负责持久化与读取，二者不得重复实现判定规则。
 */

export type AiToolRegistryDb = Pick<
  PrismaClient,
  'app' | 'appInstallation' | 'aiToolRegistryEntry' | 'merchantToolGrant' | 'appInstallationStatusEvent' | 'merchant'
>;

export function readAiToolManifest(raw: unknown): AiToolManifest | null {
  if (raw === null || raw === undefined) return null;
  const parsed = parseAiToolManifest(raw);
  return parsed.ok ? parsed.manifest : null;
}

export function summarizeManifestIssues(issues: readonly AiToolManifestIssue[]): string {
  return issues.map(issue => `${issue.path || 'manifest'}:${issue.code}`).join(', ').slice(0, 400);
}

/** 统一能力门禁：安装启用 + 应用已发布 + 运行时可用（Manifest 或历史原生白名单）。 */
export async function isAppActiveForMerchant(
  db: AiToolRegistryDb,
  merchantId: string,
  appId: string,
  options: { manifestEnabled?: boolean } = {}
): Promise<boolean> {
  const installation = await db.appInstallation.findFirst({
    where: { merchantId, status: 'active', app: { appId, status: 'published' } },
    select: { id: true, app: { select: { appId: true, version: true, manifest: true } } }
  });
  if (!installation) return false;
  const manifestEnabled = options.manifestEnabled ?? isAiToolsManifestEnabled();
  if (manifestEnabled && readAiToolManifest(installation.app.manifest)) return true;
  return isAppStoreNativeRuntimeCompatible(installation.app.appId, installation.app.version);
}

export async function loadMerchantAiToolAccess(db: AiToolRegistryDb, input: {
  merchantId: string;
  actorPermissions: readonly string[];
  agentId?: string | null;
  industry?: string | null;
  credentialKeys?: readonly { credentialKey: string; status: string }[];
  now?: Date;
}): Promise<AiToolAccess> {
  const manifestEnabled = isAiToolsManifestEnabled();
  if (!manifestEnabled) {
    return resolveAiToolAccess({ apps: [], actorPermissions: input.actorPermissions, manifestEnabled: false });
  }
  const [apps, grants] = await Promise.all([
    db.app.findMany({
      where: { manifest: { not: Prisma.DbNull } },
      select: {
        appId: true,
        status: true,
        manifest: true,
        installations: {
          where: { merchantId: input.merchantId },
          select: { status: true },
          take: 1
        }
      }
    }),
    db.merchantToolGrant.findMany({
      where: { merchantId: input.merchantId },
      select: { toolId: true, status: true, expiresAt: true }
    })
  ]);
  const appStates: AiToolAppState[] = apps.map(app => ({
    appId: app.appId,
    appStatus: app.status,
    installationStatus: app.installations[0]?.status ?? null,
    manifest: readAiToolManifest(app.manifest),
    grants
  }));
  return resolveAiToolAccess({
    apps: appStates,
    actorPermissions: input.actorPermissions,
    agentId: input.agentId ?? null,
    industry: input.industry ?? null,
    credentials: input.credentialKeys,
    now: input.now,
    manifestEnabled
  });
}

/** 安装后发放商家级工具授权（含试用到期时间）。幂等：重复安装只刷新状态与到期时间。 */
export async function grantAppTools(db: AiToolRegistryDb, input: {
  merchantId: string;
  appId: string;
  manifest: AiToolManifest;
  trialDays?: number;
  grantedBy?: string | null;
  now?: Date;
}): Promise<number> {
  const now = input.now ?? new Date();
  const trialDays = input.trialDays ?? readManifestTrialDays(input.manifest);
  const plan = planAppToolGrants({ appId: input.appId, manifest: input.manifest, trialDays, now });
  if (plan.length === 0) return 0;
  await Promise.all(plan.map(entry => db.merchantToolGrant.upsert({
    where: { merchantId_toolId: { merchantId: input.merchantId, toolId: entry.toolId } },
    create: {
      merchantId: input.merchantId,
      toolId: entry.toolId,
      appId: entry.appId,
      status: entry.status,
      source: entry.source,
      grantedBy: input.grantedBy ?? null,
      grantedAt: entry.grantedAt,
      expiresAt: entry.expiresAt
    },
    update: {
      appId: entry.appId,
      status: entry.status,
      source: entry.source,
      pausedAt: null,
      revokedAt: null,
      revokedReason: null
      // 不刷新 grantedAt / expiresAt：重复安装或重新安装不得延长试用期。
    }
  })));
  return plan.length;
}

/** 卸载或停用：只撤销本应用授权，不删除任何业务数据与账务记录。 */
export async function revokeAppToolGrants(db: AiToolRegistryDb, input: {
  merchantId: string;
  appId: string;
  reason?: string;
  now?: Date;
}): Promise<number> {
  const result = await db.merchantToolGrant.updateMany({
    where: { merchantId: input.merchantId, appId: input.appId, status: { not: 'revoked' } },
    data: {
      status: 'revoked',
      revokedAt: input.now ?? new Date(),
      revokedReason: input.reason?.slice(0, 160) ?? null
    }
  });
  return result.count;
}

/** 商家手动暂停/恢复某个工具授权（安装状态不变）。 */
export async function setMerchantToolGrantStatus(db: AiToolRegistryDb, input: {
  merchantId: string;
  toolId: string;
  status: 'active' | 'paused';
}): Promise<boolean> {
  const result = await db.merchantToolGrant.updateMany({
    where: {
      merchantId: input.merchantId,
      toolId: input.toolId,
      status: { in: ['active', 'paused'] }
    },
    data: input.status === 'paused'
      ? { status: 'paused', pausedAt: new Date() }
      : { status: 'active', pausedAt: null }
  });
  return result.count > 0;
}

/** 停用/恢复应用时批量切换该应用的全部授权；过期判定仍由 `evaluateAiTool` 统一负责。 */
export async function setAppToolGrantState(db: AiToolRegistryDb, input: {
  merchantId: string;
  appId: string;
  status: 'active' | 'paused';
  now?: Date;
}): Promise<number> {
  const now = input.now ?? new Date();
  const result = await db.merchantToolGrant.updateMany({
    where: {
      merchantId: input.merchantId,
      appId: input.appId,
      status: input.status === 'active' ? 'paused' : 'active'
    },
    data: input.status === 'active'
      ? { status: 'active', pausedAt: null }
      : { status: 'paused', pausedAt: now }
  });
  return result.count;
}

export async function recordAppInstallationStatusEvent(db: AiToolRegistryDb, input: {
  merchantId: string;
  appRecordId: string;
  appId: string;
  fromStatus: string | null;
  toStatus: string;
  actorId?: string | null;
  reason?: string | null;
}): Promise<void> {
  await db.appInstallationStatusEvent.create({
    data: {
      merchantId: input.merchantId,
      appRecordId: input.appRecordId,
      appId: input.appId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId ?? null,
      reason: input.reason?.slice(0, 160) ?? null
    }
  });
}

export type AiToolRegistryReconcileResult = { apps: number; tools: number };

/**
 * 从 `App.manifest` 重建 `AiToolRegistryEntry` 投影。幂等，可重复执行。
 * toolId 全局唯一：跨应用重复声明会抛 `TOOL_ID_CONFLICT`，由调用方拒绝保存。
 */
export async function reconcileAiToolRegistry(
  db: AiToolRegistryDb,
  options: { appId?: string } = {}
): Promise<AiToolRegistryReconcileResult> {
  const allApps = await db.app.findMany({
    where: { manifest: { not: Prisma.DbNull } },
    select: { id: true, appId: true, manifest: true }
  });
  // toolId 全局唯一：冲突检查必须覆盖全部应用，不能只检查本次保存的应用。
  const parsedApps: Array<{ id: string; manifest: AiToolManifest }> = [];
  const owners = new Map<string, string>();
  for (const app of allApps) {
    const manifest = readAiToolManifest(app.manifest);
    if (!manifest) continue;
    parsedApps.push({ id: app.id, manifest });
    for (const tool of manifest.tools) {
      const owner = owners.get(tool.toolId);
      if (owner && owner !== manifest.appId) throw new Error('TOOL_ID_CONFLICT');
      owners.set(tool.toolId, manifest.appId);
    }
  }
  const targets = options.appId
    ? parsedApps.filter(entry => entry.manifest.appId === options.appId)
    : parsedApps;
  let appCount = 0;
  let toolCount = 0;
  for (const app of targets) {
    const manifest = app.manifest;
    appCount += 1;
    for (const tool of manifest.tools) {
      const fingerprint = createHash('sha256').update(JSON.stringify(tool)).digest('hex');
      const payload = {
        appId: manifest.appId,
        appRecordId: app.id,
        version: tool.version,
        displayName: tool.displayName as unknown as Prisma.InputJsonValue,
        enabled: tool.enabled,
        status: tool.status,
        riskLevel: tool.riskLevel,
        permission: tool.permission,
        cost: tool.cost as unknown as Prisma.InputJsonValue,
        industries: tool.industries,
        employees: tool.employees,
        credentials: tool.credentials,
        fingerprint
      };
      await db.aiToolRegistryEntry.upsert({
        where: { toolId: tool.toolId },
        create: { toolId: tool.toolId, ...payload },
        update: payload
      });
      toolCount += 1;
    }
    await db.aiToolRegistryEntry.deleteMany({
      where: { appId: manifest.appId, toolId: { notIn: manifest.tools.map(tool => tool.toolId) } }
    });
  }
  return { apps: appCount, tools: toolCount };
}

/** 保存 Manifest：校验通过才写库，非法时保留上一版。 */
export async function saveAppManifest(db: AiToolRegistryDb, input: {
  appId: string;
  manifest: unknown;
}): Promise<{ ok: true; toolCount: number } | { ok: false; error: string; issues: AiToolManifestIssue[] }> {
  const parsed = parseAiToolManifest(input.manifest, { expectedAppId: input.appId });
  if (parsed.ok === false) {
    return { ok: false, error: 'TOOL_MANIFEST_INVALID', issues: parsed.issues };
  }
  const app = await db.app.findUnique({ where: { appId: input.appId }, select: { id: true, manifest: true } });
  if (!app) return { ok: false, error: 'APP_STORE_APP_NOT_FOUND', issues: [] };
  // 写入前先做跨应用 toolId 冲突检查：toolId 全局唯一，冲突时不写库，保留上一版。
  const others = await db.app.findMany({
    where: { manifest: { not: Prisma.DbNull } },
    select: { appId: true, manifest: true }
  });
  const newToolIds = new Set(parsed.manifest.tools.map(tool => tool.toolId));
  for (const other of others) {
    if (other.appId === input.appId) continue;
    const otherManifest = readAiToolManifest(other.manifest);
    if (!otherManifest) continue;
    if (otherManifest.tools.some(tool => newToolIds.has(tool.toolId))) {
      return { ok: false, error: 'TOOL_ID_CONFLICT', issues: [{ path: 'tools', code: 'TOOL_ID_CONFLICT' }] };
    }
  }
  await db.app.update({
    where: { appId: input.appId },
    data: { manifest: parsed.manifest as unknown as Prisma.InputJsonValue }
  });
  try {
    const result = await reconcileAiToolRegistry(db, { appId: input.appId });
    return { ok: true, toolCount: result.tools };
  } catch (error) {
    // 兜底回滚：任何投影失败都不允许把应用留在半更新状态。
    await db.app.update({
      where: { appId: input.appId },
      data: { manifest: app.manifest === null ? Prisma.DbNull : app.manifest as Prisma.InputJsonValue }
    });
    try {
      await reconcileAiToolRegistry(db, { appId: input.appId });
    } catch {
      // 历史数据本身已冲突时，回滚已尽力，不再掩盖原始错误。
    }
    if (error instanceof Error && error.message === 'TOOL_ID_CONFLICT') {
      return { ok: false, error: 'TOOL_ID_CONFLICT', issues: [] };
    }
    throw error;
  }
}
