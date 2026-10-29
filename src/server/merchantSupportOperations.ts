export type MerchantSupportPriority = 'urgent' | 'high' | 'normal';
export type MerchantSupportSlaState = 'pending' | 'overdue' | 'on_time' | 'late';
export type MerchantSupportSlaMinutes = Record<MerchantSupportPriority, number>;

export const defaultMerchantSupportSlaMinutes: MerchantSupportSlaMinutes = {
  urgent: 60,
  high: 240,
  normal: 1440
};

export function isMerchantSupportPriority(value: unknown): value is MerchantSupportPriority {
  return value === 'urgent' || value === 'high' || value === 'normal';
}

export function getMerchantSupportFirstResponseDueAt(
  createdAt: Date,
  priority: MerchantSupportPriority,
  slaMinutes: MerchantSupportSlaMinutes = defaultMerchantSupportSlaMinutes
): Date {
  return new Date(createdAt.getTime() + slaMinutes[priority] * 60_000);
}

export function isValidMerchantSupportSlaMinutes(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 60 && value <= 10_080;
}

export function getMerchantSupportSlaState(
  dueAt: Date | string | null,
  respondedAt: Date | string | null,
  now = new Date()
): MerchantSupportSlaState {
  if (respondedAt) {
    if (!dueAt) return 'on_time';
    return new Date(respondedAt).getTime() <= new Date(dueAt).getTime() ? 'on_time' : 'late';
  }
  if (!dueAt) return 'pending';
  return new Date(dueAt).getTime() < now.getTime() ? 'overdue' : 'pending';
}
