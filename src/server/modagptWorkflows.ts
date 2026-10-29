import {
  createReplenishmentRecommendations,
  type AiEmployeeInventoryRecord
} from './aiEmployeeInventory';

export type ModaGptLowInventoryWorkflowInput = {
  merchantId: string;
  sourceEventId: string;
  productId: string;
  sku: string;
  threshold: number;
};

export function analyzeModaGptLowInventory(
  input: ModaGptLowInventoryWorkflowInput,
  inventory: readonly AiEmployeeInventoryRecord[],
  soldUnitsBySku: ReadonlyMap<string, number>
) {
  if (
    !/^[A-Za-z0-9_-]{1,120}$/.test(input.merchantId)
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(input.sourceEventId)
    || !input.productId.trim()
    || !input.sku.trim()
    || !Number.isFinite(input.threshold)
    || input.threshold < 0
    || input.threshold > 1_000_000
  ) throw new Error('MODAGPT_INVENTORY_WORKFLOW_INPUT_INVALID');

  const item = inventory.find(record =>
    record.productId === input.productId && record.sku === input.sku
  );
  if (!item) return { status: 'source_no_longer_available' as const, sourceEventId: input.sourceEventId };
  if (item.availableQuantity > input.threshold) {
    return {
      status: 'stale_event' as const,
      sourceEventId: input.sourceEventId,
      availableQuantity: item.availableQuantity
    };
  }

  const recommendation = createReplenishmentRecommendations([item], soldUnitsBySku)[0] || null;
  return {
    status: 'analyzed' as const,
    sourceEventId: input.sourceEventId,
    merchantId: input.merchantId,
    productId: item.productId || input.productId,
    sku: item.sku,
    availableQuantity: item.availableQuantity,
    threshold: input.threshold,
    salesWindowDays: 30 as const,
    recommendation: recommendation ? {
      soldLast30Days: recommendation.soldLast30Days,
      estimatedDaysOfCover: recommendation.estimatedDaysOfCover,
      suggestedReorderQuantity: recommendation.suggestedReorderQuantity
    } : null,
    writePerformed: false as const
  };
}

export function verifyModaGptLowInventoryAnalysis(input: {
  workflow: ModaGptLowInventoryWorkflowInput;
  inventory: readonly AiEmployeeInventoryRecord[];
  soldUnitsBySku: ReadonlyMap<string, number>;
  actual: ReturnType<typeof analyzeModaGptLowInventory>;
}): { passed: boolean; checks: string[]; reason?: string } {
  const expected = analyzeModaGptLowInventory(input.workflow, input.inventory, input.soldUnitsBySku);
  if (expected.status !== input.actual.status) {
    return { passed: false, checks: ['source_status'], reason: 'SOURCE_STATUS_MISMATCH' };
  }
  if (JSON.stringify(expected) !== JSON.stringify(input.actual)) {
    return { passed: false, checks: ['source_status'], reason: 'SOURCE_DATA_MISMATCH' };
  }
  if ('writePerformed' in input.actual && input.actual.writePerformed !== false) {
    return { passed: false, checks: ['read_only'], reason: 'UNAPPROVED_SIDE_EFFECT' };
  }
  return {
    passed: true,
    checks: ['tenant_scoped_source', 'fresh_inventory', 'deterministic_calculation', 'read_only']
  };
}
