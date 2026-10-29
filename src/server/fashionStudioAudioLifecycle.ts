import type { Prisma } from '@prisma/client';

export function getFashionStudioAudioProjectReferenceFilter(assetId: string): Prisma.FashionStudioProjectWhereInput {
  return {
    tenantId: 'platform',
    document: { contains: assetId }
  };
}

export function getFashionStudioAudioTaskReferenceFilter(
  assetId: string,
  now = new Date()
): Prisma.ModaGptTaskWhereInput {
  return {
    taskType: 'studio.video.trim',
    tenantId: 'platform',
    payload: { contains: assetId },
    OR: [
      { status: { in: ['queued', 'retrying', 'planning', 'running', 'verifying'] } },
      { status: 'cancelled', lockedBy: { not: null }, lockedUntil: { gt: now } }
    ]
  };
}
