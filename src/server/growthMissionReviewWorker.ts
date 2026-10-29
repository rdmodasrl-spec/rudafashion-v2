import type { PrismaClient } from '@prisma/client';
import type { ModaGptTask } from './modagptTaskQueue';
import {
  buildGrowthMissionReviewTaskResult,
  isGrowthMissionStatus,
  parseGrowthMissionRecommendations,
  validateGrowthMissionInput
} from './growthMission';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export async function handleGrowthMissionReviewTask(
  prisma: Pick<PrismaClient, 'growthMission'>,
  task: ModaGptTask
): Promise<unknown> {
  if (
    task.merchantId !== null
    || task.tenantId !== 'platform'
    || !isRecord(task.payload)
    || task.payload.version !== 1
    || typeof task.payload.missionId !== 'string'
    || !/^[A-Za-z0-9_-]{8,40}$/.test(task.payload.missionId)
    || !Number.isInteger(task.payload.recommendationIndex)
  ) throw new Error('GROWTH_MISSION_REVIEW_TASK_INVALID');

  const mission = await prisma.growthMission.findUnique({ where: { id: task.payload.missionId } });
  if (!mission) throw new Error('GROWTH_MISSION_NOT_FOUND');
  if (!isGrowthMissionStatus(mission.status)) throw new Error('GROWTH_MISSION_STATUS_INVALID');
  const input = validateGrowthMissionInput({
    ...mission,
    budgetAmount: Number(mission.budgetAmount),
    markets: JSON.parse(mission.markets),
    channels: JSON.parse(mission.channels),
    startAt: mission.startAt.toISOString(),
    endAt: mission.endAt.toISOString()
  });
  const storedPlan: unknown = JSON.parse(mission.plan);
  if (!isRecord(storedPlan) || !isRecord(storedPlan.strategy)
    || storedPlan.strategy.source !== 'ai_draft'
    || storedPlan.strategy.executionEnabled !== false
    || !Array.isArray(storedPlan.strategy.recommendations)) {
    throw new Error('GROWTH_MISSION_STRATEGY_INVALID');
  }
  const recommendations = parseGrowthMissionRecommendations(
    JSON.stringify({ recommendations: storedPlan.strategy.recommendations }),
    input
  );
  const recommendationIndex = task.payload.recommendationIndex;
  if (!Number.isInteger(recommendationIndex)
    || Number(recommendationIndex) < 0
    || Number(recommendationIndex) >= recommendations.length) {
    throw new Error('GROWTH_MISSION_RECOMMENDATION_NOT_FOUND');
  }
  return buildGrowthMissionReviewTaskResult({
    missionId: mission.id,
    missionStatus: mission.status,
    recommendationIndex: Number(recommendationIndex),
    recommendations
  });
}
