import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  getModaGptCoreAgentRoles,
  resolveModaGptIndustryPack,
  type ModaGptIndustry,
  type ModaGptIndustrySource
} from './modagptCoreEmployees';

type ProvisionIndustryTeamInput = {
  tx: Prisma.TransactionClient;
  merchantId: string;
  industry: ModaGptIndustry;
  industrySource?: ModaGptIndustrySource;
  idempotencyKey: string;
  actorId?: string | null;
};

export async function provisionModaGptIndustryTeam({
  tx,
  merchantId,
  industry,
  industrySource,
  idempotencyKey,
  actorId = null
}: ProvisionIndustryTeamInput) {
  const normalizedKey = idempotencyKey.trim();
  if (!normalizedKey || normalizedKey.length > 160) {
    throw new Error('A valid ModaUI provisioning idempotency key is required');
  }

  const pack = resolveModaGptIndustryPack(industry);
  const assignments = getModaGptCoreAgentRoles().map(agentId => pack.employees[agentId]);
  const configHash = createHash('sha256').update(JSON.stringify({
    industry: pack.id,
    workflows: pack.workflows,
    assignments
  })).digest('hex');
  const [merchant, priorRun] = await Promise.all([
    tx.merchant.findUnique({
      where: { id: merchantId },
      select: { industry: true, industrySource: true }
    }),
    tx.merchantAiTeamProvisionRun.findUnique({
      where: { merchantId_idempotencyKey: { merchantId, idempotencyKey: normalizedKey } },
      select: { configHash: true, status: true, industry: true }
    })
  ]);
  if (!merchant) throw new Error(`Merchant ${merchantId} does not exist for AI team provisioning`);
  if (priorRun && priorRun.configHash !== configHash) {
    throw new Error('ModaUI provisioning idempotency key was reused with a different configuration');
  }
  if (priorRun?.status === 'completed') {
    if (merchant.industry !== pack.id) {
      throw new Error('Completed ModaUI provisioning request cannot be replayed after a later industry change');
    }
    return tx.merchantAiTeamAssignment.findMany({
      where: { merchantId, industry: pack.id },
      orderBy: { agentId: 'asc' }
    });
  }

  await tx.merchant.update({
    where: { id: merchantId },
    data: {
      industry: pack.id,
      ...(industrySource ? { industrySource } : {})
    }
  });

  await tx.merchantAiTeamProvisionRun.upsert({
    where: { merchantId_idempotencyKey: { merchantId, idempotencyKey: normalizedKey } },
    create: {
      merchantId,
      idempotencyKey: normalizedKey,
      industry: pack.id,
      configHash,
      status: 'started'
    },
    update: {
      industry: pack.id,
      configHash,
      status: 'started',
      completedAt: null
    }
  });

  for (const assignment of assignments) {
    const configuration = JSON.stringify({
      ...assignment,
      workflows: pack.workflows
    });
    await tx.merchantAiTeamAssignment.upsert({
      where: { merchantId_agentId: { merchantId, agentId: assignment.agentId } },
      create: {
        merchantId,
        agentId: assignment.agentId,
        industry: pack.id,
        displayName: assignment.displayName,
        configuration,
        packVersion: assignment.version,
        status: 'configured'
      },
      update: {
        industry: pack.id,
        displayName: assignment.displayName,
        configuration,
        packVersion: assignment.version,
        status: 'configured'
      }
    });
  }

  if (merchant.industry !== pack.id) {
    await tx.employeeAuditLog.create({
      data: {
        id: randomUUID(),
        merchantId,
        employeeId: null,
        action: 'modagpt.industry.changed',
        entityType: 'merchant_industry',
        entityId: merchantId,
        metadata: JSON.stringify({
          from: merchant.industry,
          to: pack.id,
          actorId
        })
      }
    });
  }

  await tx.merchantAiTeamProvisionRun.update({
    where: { merchantId_idempotencyKey: { merchantId, idempotencyKey: normalizedKey } },
    data: {
      status: 'completed',
      completedAt: new Date()
    }
  });

  return tx.merchantAiTeamAssignment.findMany({
    where: { merchantId, industry: pack.id },
    orderBy: { agentId: 'asc' }
  });
}
